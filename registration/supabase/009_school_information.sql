-- School is required for new registrations; existing rows remain readable.
begin;
alter table public.players add column school text not null default '' check(char_length(school)<=80 and school=btrim(school));
create function public.register_person(p_name text,p_gender text,p_phone text,p_school text) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 if p_school is null or char_length(btrim(p_school)) not between 1 and 80 then raise exception 'INVALID_INPUT'; end if;
 result:=register_person(p_name,p_gender,p_phone);
 update public.players set school=btrim(p_school) where id=(result->>'id')::uuid;
 return result;
end $$;
create or replace function public.registration_admin_register_person(p_hash text,p_input jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 perform registration_admin_assert(p_hash);
 perform register_person(p_input->>'name',p_input->>'gender',p_input->>'phone',p_input->>'school');
end $$;
create or replace function public.registration_snapshot(p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.players; result jsonb;
begin
 actor:=public.registration_actor(p_hash);
 select jsonb_build_object(
  'viewer',jsonb_build_object('id',actor.id,'name',actor.name,'gender',actor.gender,'school',actor.school,'role',actor.role,'teamId',actor.team_id),
  'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'captainId',t.captain_id,'captainPhone',c.phone,
   'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'gender',p.gender,'school',p.school,'role',p.role,'teamId',p.team_id) order by (p.id=t.captain_id) desc,p.created_at,p.id),'[]'::jsonb) from public.players p where p.team_id=t.id)) order by (t.id=actor.team_id) desc nulls last,t.created_at,t.id),'[]'::jsonb) from public.teams t join public.players c on c.id=t.captain_id),
  'freePlayers',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'gender',p.gender,'school',p.school,'role',p.role,'teamId',p.team_id) order by p.created_at,p.id),'[]'::jsonb) from public.players p where p.team_id is null and p.role='player'),
  'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'playerId',a.player_id,'teamId',a.team_id,'name',p.name,'gender',p.gender,'school',p.school,'teamName',t.name,'status',a.status,'createdAt',a.created_at) order by a.created_at desc,a.id),'[]'::jsonb) from public.applications a join public.players p on p.id=a.player_id join public.teams t on t.id=a.team_id where (actor.role='captain' and t.captain_id=actor.id) or a.player_id=actor.id)
 ) into result;
 return result;
end $$;
create or replace function public.registration_admin_snapshot(p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform registration_admin_assert(p_hash);
 return jsonb_build_object(
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'gender',gender,'school',school,'phone',phone,'role',role,'teamId',team_id) order by created_at,id),'[]') from players),
 'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'captainId',captain_id) order by created_at,id),'[]') from teams),
 'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'playerId',a.player_id,'teamId',a.team_id,'name',p.name,'gender',p.gender,'teamName',t.name,'status',a.status,'createdAt',a.created_at) order by a.created_at desc),'[]') from applications a join players p on p.id=a.player_id join teams t on t.id=a.team_id)
 );
end $$;
create or replace function public.registration_admin_action(p_hash text,p_input jsonb) returns void language plpgsql security definer set search_path=public as $$
declare v_action text:=p_input->>'action'; v_team uuid:=(p_input->>'teamId')::uuid; v_player uuid:=(p_input->>'playerId')::uuid; v_app uuid:=(p_input->>'applicationId')::uuid; v_old uuid; v_name text:=btrim(p_input->>'name'); v_created jsonb; target public.players; app public.applications;
begin
 perform registration_admin_assert(p_hash);
 -- Serialize multi-table administrative changes with ordinary registration/membership writes.
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 if v_action in ('rename_team','create_team') and (v_name is null or char_length(v_name) not between 1 and 40) then raise exception 'INVALID_INPUT'; end if;
 if v_action in ('rename_team','set_captain','delete_team') or (v_action in ('move_player','create_player') and v_team is not null) then
  if not exists(select 1 from teams where id=v_team) then raise exception 'TEAM_NOT_FOUND'; end if;
 end if;
 if v_action in ('set_captain','create_team','move_player','edit_player','delete_player') then
  select * into target from players where id=v_player;
  if target.id is null then raise exception 'NOT_FOUND'; end if;
 end if;
 if v_action='rename_team' then update teams set name=v_name where id=v_team;
 elsif v_action in ('set_captain','create_team') then
  if exists(select 1 from teams where captain_id=v_player and (v_action='create_team' or id<>v_team)) then raise exception 'CAPTAIN_CONFLICT'; end if;
  if v_action='create_team' then
   insert into teams(name,captain_id) values(v_name,v_player) returning id into v_team;
  else
   select captain_id into v_old from teams where id=v_team;
   update players set role='player' where id=v_old;
   update teams set captain_id=v_player where id=v_team;
  end if;
  update players set role='captain',team_id=v_team where id=v_player;
  update applications set status='cancelled',processed_at=now() where player_id=v_player and status='pending';
 elsif v_action='move_player' then
  if target.role='captain' then raise exception 'CAPTAIN_CONFLICT'; end if;
  update players set team_id=v_team where id=v_player;
  update applications set status='cancelled',processed_at=now() where player_id=v_player and status='pending';
 elsif v_action='edit_player' then
  if (p_input->>'school') is null or char_length(btrim(p_input->>'school')) not between 1 and 80 then raise exception 'INVALID_INPUT'; end if;
  if v_name is null or char_length(v_name) not between 1 and 30 or (p_input->>'gender') is null or (p_input->>'gender') not in ('男','女') or (p_input->>'phone') is null or (p_input->>'phone') !~ '^1[3-9][0-9]{9}$' then raise exception 'INVALID_INPUT'; end if;
  update players set name=v_name,gender=p_input->>'gender',phone=p_input->>'phone',school=btrim(p_input->>'school') where id=v_player;
 elsif v_action='create_player' then
  v_created:=register_person(v_name,p_input->>'gender',p_input->>'phone',p_input->>'school');
  update players set team_id=v_team where id=(v_created->>'id')::uuid;
 elsif v_action='delete_player' then
  if target.role='captain' or exists(select 1 from teams where captain_id=v_player) then raise exception 'CAPTAIN_CONFLICT'; end if;
  delete from applications where player_id=v_player;
  delete from sessions where player_id=v_player;
  delete from players where id=v_player;
 elsif v_action='delete_team' then
  delete from applications where team_id=v_team;
  update players set team_id=null,role='player' where team_id=v_team;
  delete from teams where id=v_team;
 elsif v_action in ('approve','reject') then
  select * into app from applications where id=v_app;
  if app.id is null or app.status<>'pending' then raise exception 'APPLICATION_CLOSED'; end if;
  if v_action='reject' then update applications set status='rejected',processed_at=now() where id=v_app;
  else
   select * into target from players where id=app.player_id;
   if target.role<>'player' or target.team_id is not null then raise exception 'ALREADY_JOINED'; end if;
   update players set team_id=app.team_id where id=app.player_id;
   update applications set status=case when id=v_app then 'approved' else 'cancelled' end,processed_at=now() where player_id=app.player_id and status='pending';
  end if;
 else raise exception 'INVALID_INPUT'; end if;
exception when unique_violation then
 if v_action in ('edit_player','create_player') then raise exception 'PHONE_EXISTS'; else raise exception 'TEAM_EXISTS'; end if;
end $$;
-- Retire the old service API that allowed registrations without school information.
revoke execute on function public.register_person(text,text,text),public.register_player(text,text,text,text,text,uuid) from service_role;
revoke all on function public.register_person(text,text,text,text),public.registration_admin_register_person(text,jsonb),public.registration_snapshot(text),public.registration_admin_snapshot(text),public.registration_admin_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.register_person(text,text,text,text),public.registration_admin_register_person(text,jsonb),public.registration_snapshot(text),public.registration_admin_snapshot(text),public.registration_admin_action(text,jsonb) to service_role;
commit;

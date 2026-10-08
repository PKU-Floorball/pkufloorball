begin;
create table public.admin_sessions(token_hash text primary key, expires_at timestamptz not null default now()+interval '8 hours');
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from anon,authenticated;
grant all on public.admin_sessions to service_role;
create function public.registration_admin_login(p_hash text) returns void language plpgsql security definer set search_path=public as $$
begin
 delete from admin_sessions where expires_at<=now();
 insert into admin_sessions(token_hash) values(p_hash);
end $$;
create function public.registration_admin_assert(p_hash text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from admin_sessions where token_hash=p_hash and expires_at>now()) then raise exception 'UNAUTHORIZED'; end if;
end $$;
create function public.registration_admin_logout(p_hash text) returns void language sql security definer set search_path=public as $$
 delete from admin_sessions where token_hash=p_hash;
$$;
create function public.registration_admin_snapshot(p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform registration_admin_assert(p_hash);
 return jsonb_build_object(
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'gender',gender,'phone',phone,'role',role,'teamId',team_id) order by created_at,id),'[]') from players),
 'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'captainId',captain_id) order by created_at,id),'[]') from teams),
 'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'playerId',a.player_id,'teamId',a.team_id,'name',p.name,'gender',p.gender,'teamName',t.name,'status',a.status,'createdAt',a.created_at) order by a.created_at desc),'[]') from applications a join players p on p.id=a.player_id join teams t on t.id=a.team_id)
 );
end $$;
create function public.registration_admin_action(p_hash text,p_input jsonb) returns void language plpgsql security definer set search_path=public as $$
declare v_action text:=p_input->>'action'; v_team uuid:=(p_input->>'teamId')::uuid; v_player uuid:=(p_input->>'playerId')::uuid; v_app uuid:=(p_input->>'applicationId')::uuid; v_old uuid; v_name text:=btrim(p_input->>'name'); target public.players; app public.applications;
begin
 perform registration_admin_assert(p_hash);
 -- Serialize multi-table administrative changes with ordinary registration/membership writes.
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 if v_action in ('rename_team','create_team') and (v_name is null or char_length(v_name) not between 1 and 40) then raise exception 'INVALID_INPUT'; end if;
 if v_action in ('rename_team','set_captain','delete_team') or (v_action in ('move_player','create_player') and v_team is not null) then
  if not exists(select 1 from teams where id=v_team) then raise exception 'TEAM_NOT_FOUND'; end if;
 end if;
 if v_action in ('set_captain','create_team','move_player','edit_player') then
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
  if v_name is null or char_length(v_name) not between 1 and 30 or (p_input->>'gender') is null or (p_input->>'gender') not in ('男','女') or (p_input->>'phone') is null or (p_input->>'phone') !~ '^1[3-9][0-9]{9}$' then raise exception 'INVALID_INPUT'; end if;
  update players set name=v_name,gender=p_input->>'gender',phone=p_input->>'phone' where id=v_player;
 elsif v_action='create_player' then
  perform register_player(v_name,p_input->>'gender',p_input->>'phone','player',null,v_team);
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
revoke all on function public.registration_admin_login(text),public.registration_admin_assert(text),public.registration_admin_logout(text),public.registration_admin_snapshot(text),public.registration_admin_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.registration_admin_login(text),public.registration_admin_logout(text),public.registration_admin_snapshot(text),public.registration_admin_action(text,jsonb) to service_role;
commit;

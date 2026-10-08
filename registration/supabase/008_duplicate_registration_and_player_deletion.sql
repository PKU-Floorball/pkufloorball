-- Matching registrations get a login hint. Administrator deletion preserves team invariants.
begin;
create or replace function public.register_person(p_name text,p_gender text,p_phone text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 30 or p_gender is null or p_gender not in ('男','女') or p_phone is null or p_phone !~ '^1[3-9][0-9]{9}$' then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from public.players where name=btrim(p_name) and phone=p_phone) then raise exception 'ALREADY_REGISTERED'; end if;
 return register_player(p_name,p_gender,p_phone,'player',null,null);
end $$;
create or replace function public.login_player(p_name text,p_phone text,p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_ids uuid[]; n integer;
begin
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 -- Resolve both ambiguity and identity from a single statement snapshot.
 select array_agg(id) into v_ids from public.players where name=btrim(p_name) and (p_phone is null or phone=p_phone);
 n:=coalesce(cardinality(v_ids),0);
 if n=0 then raise exception 'NOT_FOUND'; end if;
 if n>1 then raise exception 'NEED_PHONE'; end if;
 v_id:=v_ids[1];
 delete from public.sessions where expires_at<=now();
 insert into public.sessions(token_hash,player_id) values(p_hash,v_id);
 return jsonb_build_object('id',v_id);
end $$;
create or replace function public.registration_admin_action(p_hash text,p_input jsonb) returns void language plpgsql security definer set search_path=public as $$
declare v_action text:=p_input->>'action'; v_team uuid:=(p_input->>'teamId')::uuid; v_player uuid:=(p_input->>'playerId')::uuid; v_app uuid:=(p_input->>'applicationId')::uuid; v_old uuid; v_name text:=btrim(p_input->>'name'); target public.players; app public.applications;
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
  if v_name is null or char_length(v_name) not between 1 and 30 or (p_input->>'gender') is null or (p_input->>'gender') not in ('男','女') or (p_input->>'phone') is null or (p_input->>'phone') !~ '^1[3-9][0-9]{9}$' then raise exception 'INVALID_INPUT'; end if;
  update players set name=v_name,gender=p_input->>'gender',phone=p_input->>'phone' where id=v_player;
 elsif v_action='create_player' then
  perform register_player(v_name,p_input->>'gender',p_input->>'phone','player',null,v_team);
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

revoke all on function public.register_person(text,text,text),public.login_player(text,text,text),public.registration_admin_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.register_person(text,text,text),public.login_player(text,text,text),public.registration_admin_action(text,jsonb) to service_role;
commit;

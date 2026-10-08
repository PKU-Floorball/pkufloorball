-- Synchronize ordinary membership actions with administrative changes.
begin;
create or replace function public.registration_action(p_hash text,p_action text,p_team_id uuid default null,p_player_id uuid default null,p_application_id uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare actor public.players; target public.players; app public.applications; v_team uuid; v_player uuid;
begin
 -- Lock before reading actor identity or team ownership.
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 actor:=public.registration_actor(p_hash);
 if p_action='apply' then
  select * into actor from public.players where id=actor.id for update;
  if actor.role<>'player' then raise exception 'FORBIDDEN'; end if;
  if actor.team_id is not null then raise exception 'ALREADY_JOINED'; end if;
  if p_team_id is null or not exists(select 1 from public.teams where id=p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;
  if exists(select 1 from public.applications where player_id=actor.id and team_id=p_team_id and status='pending') then raise exception 'DUPLICATE_APPLICATION'; end if;
  insert into public.applications(player_id,team_id) values(actor.id,p_team_id); return;
 end if;
 if actor.role<>'captain' then raise exception 'FORBIDDEN'; end if;
 if p_action in ('recruit','remove') then v_team:=p_team_id; v_player:=p_player_id;
 elsif p_action in ('approve','reject') then
  select * into app from public.applications where id=p_application_id;
  if app.id is null then raise exception 'APPLICATION_CLOSED'; end if;
  v_team:=app.team_id; v_player:=app.player_id;
 else raise exception 'INVALID_INPUT'; end if;
 if not exists(select 1 from public.teams where id=v_team and captain_id=actor.id) then raise exception 'FORBIDDEN'; end if;
 -- Every membership change locks the same player before any application rows.
 select * into target from public.players where id=v_player for update;
 if target.id is null then raise exception 'NOT_FOUND'; end if;
 if p_action='remove' then
  if target.role<>'player' then raise exception 'FORBIDDEN'; end if;
  if target.team_id is distinct from v_team then raise exception 'PLAYER_NOT_IN_TEAM'; end if;
  update public.players set team_id=null where id=target.id;
  return;
 end if;
 if p_action in ('approve','reject') then
  select * into app from public.applications where id=p_application_id for update;
  if app.status<>'pending' then raise exception 'APPLICATION_CLOSED'; end if;
 end if;
 if target.team_id is not null then raise exception 'ALREADY_JOINED'; end if;
 if target.role<>'player' then raise exception 'FORBIDDEN'; end if;
 if p_action='reject' then
  update public.applications set status='rejected',processed_at=now() where id=app.id; return;
 end if;
 update public.players set team_id=v_team where id=target.id;
 update public.applications set status=case when id=p_application_id and p_action='approve' then 'approved' else 'cancelled' end,processed_at=now() where player_id=target.id and status='pending';
end $$;

revoke all on function public.registration_action(text,text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.registration_action(text,text,uuid,uuid,uuid) to service_role;
commit;

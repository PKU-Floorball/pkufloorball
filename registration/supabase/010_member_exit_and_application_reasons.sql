-- Self-service membership changes and optional application reasons.
begin;
alter table public.applications add column reason text not null default '' check(char_length(reason)<=500 and reason=btrim(reason));
drop function public.registration_action(text,text,uuid,uuid,uuid);
create or replace function public.registration_action(p_hash text,p_action text,p_team_id uuid default null,p_player_id uuid default null,p_application_id uuid default null,p_reason text default null,p_source_team_id uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare actor public.players; target public.players; app public.applications; v_team uuid; v_player uuid;
begin
 -- Lock before reading actor identity or team ownership.
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 actor:=public.registration_actor(p_hash);
 if p_action='leave_team' then
  if actor.role='captain' then raise exception 'CAPTAIN_CONFLICT'; end if;
  if p_team_id is null or actor.team_id is null or actor.team_id is distinct from p_team_id then raise exception 'PLAYER_NOT_IN_TEAM'; end if;
  update public.players set team_id=null where id=actor.id;
  update public.applications set status='cancelled',processed_at=now() where player_id=actor.id and status='pending';
  return;
 end if;
 if p_action in ('apply','switch_apply') then
  select * into actor from public.players where id=actor.id for update;
  if actor.role<>'player' then raise exception 'CAPTAIN_CONFLICT'; end if;
  if char_length(btrim(coalesce(p_reason,'')))>500 then raise exception 'INVALID_INPUT'; end if;
  if p_action='switch_apply' then
   if p_source_team_id is null or actor.team_id is null or actor.team_id is distinct from p_source_team_id then raise exception 'PLAYER_NOT_IN_TEAM'; end if;
   if p_team_id=p_source_team_id then raise exception 'INVALID_INPUT'; end if;
  elsif actor.team_id is not null then raise exception 'ALREADY_JOINED'; end if;
  if p_team_id is null or not exists(select 1 from public.teams where id=p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;
  if exists(select 1 from public.applications where player_id=actor.id and team_id=p_team_id and status='pending') then raise exception 'DUPLICATE_APPLICATION'; end if;
  if p_action='switch_apply' then
   update public.players set team_id=null where id=actor.id;
   update public.applications set status='cancelled',processed_at=now() where player_id=actor.id and status='pending';
  end if;
  insert into public.applications(player_id,team_id,reason) values(actor.id,p_team_id,btrim(coalesce(p_reason,''))); return;
 end if;
 if actor.role<>'captain' then raise exception 'FORBIDDEN'; end if;
 if p_action in ('transfer_captain','leave_captain','dissolve_team') then
  if not exists(select 1 from public.teams where id=p_team_id and captain_id=actor.id) then raise exception 'FORBIDDEN'; end if;
  if p_action='dissolve_team' then
   delete from public.applications where team_id=p_team_id;
   update public.players set team_id=null,role='player' where team_id=p_team_id;
   delete from public.teams where id=p_team_id;
   return;
  end if;
  select * into target from public.players where id=p_player_id;
  if target.id is null or target.id=actor.id or target.role<>'player' or target.team_id is distinct from p_team_id then raise exception 'INVALID_SUCCESSOR'; end if;
  update public.teams set captain_id=target.id where id=p_team_id;
  update public.players set role='captain' where id=target.id;
  update public.players set role='player',team_id=case when p_action='leave_captain' then null else p_team_id end where id=actor.id;
  return;
 end if;
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

revoke all on function public.registration_action(text,text,uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.registration_action(text,text,uuid,uuid,uuid,text,uuid) to service_role;


create or replace function public.registration_snapshot(p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.players; result jsonb;
begin
 actor:=public.registration_actor(p_hash);
 select jsonb_build_object(
  'viewer',jsonb_build_object('id',actor.id,'name',actor.name,'gender',actor.gender,'school',actor.school,'role',actor.role,'teamId',actor.team_id),
  'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'captainId',t.captain_id,'captainPhone',c.phone,
   'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'gender',p.gender,'school',p.school,'role',p.role,'teamId',p.team_id) order by (p.id=t.captain_id) desc,p.created_at,p.id),'[]'::jsonb) from public.players p where p.team_id=t.id)) order by (t.id=actor.team_id) desc nulls last,t.created_at,t.id),'[]'::jsonb) from public.teams t join public.players c on c.id=t.captain_id),
  'freePlayers',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'gender',p.gender,'school',p.school,'role',p.role,'teamId',p.team_id) order by p.created_at,p.id),'[]'::jsonb) from public.players p where p.team_id is null and p.role='player'),
  'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'playerId',a.player_id,'teamId',a.team_id,'name',p.name,'gender',p.gender,'school',p.school,'teamName',t.name,'reason',a.reason,'status',a.status,'createdAt',a.created_at) order by a.created_at desc,a.id),'[]'::jsonb) from public.applications a join public.players p on p.id=a.player_id join public.teams t on t.id=a.team_id where (actor.role='captain' and t.captain_id=actor.id) or a.player_id=actor.id)
 ) into result;
 return result;
end $$;

create or replace function public.registration_admin_snapshot(p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform registration_admin_assert(p_hash);
 return jsonb_build_object(
 'players',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'gender',gender,'school',school,'phone',phone,'role',role,'teamId',team_id) order by created_at,id),'[]') from players),
 'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'captainId',captain_id) order by created_at,id),'[]') from teams),
 'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'playerId',a.player_id,'teamId',a.team_id,'name',p.name,'gender',p.gender,'teamName',t.name,'reason',a.reason,'status',a.status,'createdAt',a.created_at) order by a.created_at desc),'[]') from applications a join players p on p.id=a.player_id join teams t on t.id=a.team_id)
 );
end $$;

revoke all on function public.registration_snapshot(text),public.registration_admin_snapshot(text) from public,anon,authenticated;
grant execute on function public.registration_snapshot(text),public.registration_admin_snapshot(text) to service_role;
commit;

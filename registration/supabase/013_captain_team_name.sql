begin;
create or replace function public.registration_rename_team(p_hash text, p_team_id uuid, p_name text)
returns void language plpgsql security definer set search_path=public as $$
declare actor public.players; new_name text := btrim(coalesce(p_name,''));
begin
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 actor := public.registration_actor(p_hash);
 if actor.role <> 'captain' or not exists(select 1 from public.teams where id=p_team_id and captain_id=actor.id) then
  raise exception 'FORBIDDEN';
 end if;
 if char_length(new_name) < 1 or char_length(new_name) > 40 then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from public.teams where name=new_name and id<>p_team_id) then raise exception 'TEAM_EXISTS'; end if;
 update public.teams set name=new_name where id=p_team_id;
end $$;
revoke all on function public.registration_rename_team(text,uuid,text) from public,anon,authenticated;
grant execute on function public.registration_rename_team(text,uuid,text) to service_role;
commit;

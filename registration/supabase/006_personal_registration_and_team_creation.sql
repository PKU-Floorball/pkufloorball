-- Preserve existing registrations/teams. New registrations are free agents; captains emerge when teams are created.
begin;
create function public.register_person(p_name text,p_gender text,p_phone text) returns jsonb language sql security definer set search_path=public as $$
 select register_player(p_name,p_gender,p_phone,'player',null,null);
$$;
create function public.registration_admin_register_person(p_hash text,p_input jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 perform registration_admin_assert(p_hash);
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 perform register_person(p_input->>'name',p_input->>'gender',p_input->>'phone');
end $$;
create function public.registration_create_team(p_hash text,p_name text,p_member_ids uuid[]) returns void language plpgsql security definer set search_path=public as $$
declare actor public.players; v_team uuid; v_members uuid[]:=coalesce(p_member_ids,'{}'::uuid[]);
begin
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 actor:=registration_actor(p_hash);
 if actor.team_id is not null or actor.role<>'player' then raise exception 'ALREADY_JOINED'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then raise exception 'INVALID_INPUT'; end if;
 if cardinality(v_members)>80 or actor.id=any(v_members) or exists(select 1 from unnest(v_members) as x(id) where id is null) or cardinality(v_members)<>(select count(distinct id) from unnest(v_members) as x(id)) then raise exception 'INVALID_INPUT'; end if;
 if (select count(*) from players where id=any(v_members) and team_id is null and role='player')<>cardinality(v_members) then raise exception 'PLAYER_UNAVAILABLE'; end if;
 insert into teams(name,captain_id) values(btrim(p_name),actor.id) returning id into v_team;
 update players set role='captain',team_id=v_team where id=actor.id;
 update players set team_id=v_team where id=any(v_members);
 update applications set status='cancelled',processed_at=now() where (player_id=actor.id or player_id=any(v_members)) and status='pending';
exception when unique_violation then raise exception 'TEAM_EXISTS';
end $$;
revoke all on function public.register_person(text,text,text),public.registration_admin_register_person(text,jsonb),public.registration_create_team(text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.register_person(text,text,text),public.registration_admin_register_person(text,jsonb),public.registration_create_team(text,text,uuid[]) to service_role;
-- Retire the obsolete administrator signup-as-captain RPC. Team management remains available.
revoke execute on function public.registration_admin_create_captain(text,jsonb) from service_role;
commit;

begin;
create or replace function public.registration_update_profile(p_hash text,p_input jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare actor public.players; v_name text:=btrim(p_input->>'name'); v_school text:=btrim(p_input->>'school'); v_phone text:=btrim(p_input->>'phone'); v_gender text:=p_input->>'gender';
begin
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 actor:=public.registration_actor(p_hash);
 if v_name is null or char_length(v_name) not between 1 and 30
  or v_school is null or char_length(v_school) not between 1 and 80
  or v_phone is null or v_phone !~ '^1[3-9][0-9]{9}$'
  or v_gender is null or v_gender not in ('男','女','非二元性别','不愿意透露') then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from public.players where id<>actor.id and phone=v_phone) then raise exception 'PHONE_EXISTS'; end if;
 if exists(select 1 from public.players where id<>actor.id and name=v_name and right(phone,4)=right(v_phone,4)) then raise exception 'LOGIN_AMBIGUOUS'; end if;
 update public.players set name=v_name,school=v_school,phone=v_phone,gender=v_gender where id=actor.id;
end $$;
revoke all on function public.registration_update_profile(text,jsonb) from public,anon,authenticated;
grant execute on function public.registration_update_profile(text,jsonb) to service_role;
do $$
declare definition text; anchor text := '''viewer'',jsonb_build_object(''id'',actor.id,';
begin
 definition:=pg_get_functiondef('public.registration_snapshot(text)'::regprocedure);
 if position('''phone'',actor.phone' in definition)=0 then
  if position(anchor in definition)=0 then raise exception 'Unexpected snapshot definition'; end if;
  definition:=replace(definition,anchor,anchor||'''phone'',actor.phone,');
  execute definition;
 end if;
end $$;
commit;

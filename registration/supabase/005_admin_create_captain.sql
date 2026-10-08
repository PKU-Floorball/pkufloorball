-- Add administrator creation of a captain and their new team in one transaction.
begin;
create function public.registration_admin_create_captain(p_hash text,p_input jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 perform registration_admin_assert(p_hash);
 lock table public.players,public.teams,public.applications in share row exclusive mode;
 perform register_player(p_input->>'name',p_input->>'gender',p_input->>'phone','captain',p_input->>'teamName',null);
end $$;
revoke all on function public.registration_admin_create_captain(text,jsonb) from public,anon,authenticated;
grant execute on function public.registration_admin_create_captain(text,jsonb) to service_role;
commit;

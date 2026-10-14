begin;
create table if not exists public.message_read_receipts (
 player_id uuid not null references public.players(id) on delete cascade,
 message_id uuid not null,
 status text not null check(status in ('received','pending','approved','rejected','cancelled')),
 primary key(player_id,message_id)
);
alter table public.message_read_receipts enable row level security;
revoke all on public.message_read_receipts from public,anon,authenticated;
grant all on public.message_read_receipts to service_role;

create or replace function public.registration_read_messages(p_hash text,p_receipts jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare actor public.players; receipt jsonb; v_message_id uuid; message_status text;
begin
 actor := public.registration_actor(p_hash);
 if jsonb_typeof(p_receipts) is distinct from 'array' then raise exception 'INVALID_INPUT'; end if;
 if jsonb_array_length(p_receipts)>30 then raise exception 'INVALID_INPUT'; end if;
 for receipt in select value from jsonb_array_elements(p_receipts) loop
  v_message_id := (receipt->>'id')::uuid;
  message_status := receipt->>'status';
  if exists(select 1 from public.player_notifications n where n.id=v_message_id and n.player_id=actor.id and message_status='received')
   or exists(select 1 from public.applications a join public.teams t on t.id=a.team_id
    where a.id=v_message_id and a.status=message_status and (a.player_id=actor.id or (actor.role='captain' and t.captain_id=actor.id))) then
   insert into public.message_read_receipts(player_id,message_id,status) values(actor.id,v_message_id,message_status)
   on conflict(player_id,message_id) do update set status=excluded.status;
  end if;
 end loop;
end $$;
revoke all on function public.registration_read_messages(text,jsonb) from public,anon,authenticated;
grant execute on function public.registration_read_messages(text,jsonb) to service_role;

do $$
declare definition text;
begin
 definition := pg_get_functiondef('public.registration_snapshot(text)'::regprocedure);
 if position('message_read_receipts' in definition)=0 then
  if position('return result ||' in definition)=0 then raise exception 'Unexpected snapshot definition'; end if;
  definition := replace(definition,'return result ||', $patch$
  return result || jsonb_build_object('readMessages', (
   select coalesce(jsonb_object_agg(r.message_id::text,r.status),'{}'::jsonb)
   from public.message_read_receipts r where r.player_id=actor.id
  )) ||
  $patch$);
  execute definition;
 end if;
end $$;
commit;

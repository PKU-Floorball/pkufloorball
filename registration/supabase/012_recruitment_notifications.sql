begin;
create table if not exists public.player_notifications (
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null references public.players(id) on delete cascade,
 actor_name text not null,
 team_name text not null,
 created_at timestamptz not null default now()
);
create index if not exists player_notifications_recipient on public.player_notifications(player_id, created_at desc);
alter table public.player_notifications enable row level security;
revoke all on public.player_notifications from public, anon, authenticated;
grant all on public.player_notifications to service_role;

-- Keep the existing authorization and membership transaction intact.
do $$
declare definition text; anchor text := 'update public.players set team_id=v_team where id=target.id;';
begin
 definition := pg_get_functiondef('public.registration_action(text,text,uuid,uuid,uuid,text,uuid)'::regprocedure);
 if position('insert into public.player_notifications' in definition) = 0 then
  if position(anchor in definition) = 0 then raise exception 'Unexpected registration_action definition'; end if;
  definition := replace(definition, anchor, anchor || $patch$
 if p_action='recruit' then
  insert into public.player_notifications(player_id,actor_name,team_name)
  select target.id,actor.name,t.name from public.teams t where t.id=v_team;
 end if;
 $patch$);
  execute definition;
 end if;
 definition := pg_get_functiondef('public.registration_snapshot(text)'::regprocedure);
 if position('public.player_notifications' in definition) = 0 then
  if position('return result;' in definition) = 0 then raise exception 'Unexpected registration_snapshot definition'; end if;
  definition := replace(definition, 'return result;', $patch$
 return result || jsonb_build_object('notifications', (
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'actorName',n.actor_name,'teamName',n.team_name,'createdAt',n.created_at) order by n.created_at desc,n.id),'[]'::jsonb)
  from (select * from public.player_notifications where player_id=actor.id order by created_at desc,id limit 100) n
 ));
 $patch$);
  execute definition;
 end if;
end $$;
commit;

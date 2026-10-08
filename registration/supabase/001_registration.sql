-- Initial migration. Run once in Supabase SQL Editor.
begin;
create table public.players (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 1 and 30 and name=btrim(name)),
 gender text not null check(gender in ('男','女')), phone text not null unique check(phone ~ '^1[3-9][0-9]{9}$'),
 role text not null check(role in ('captain','player')), team_id uuid, created_at timestamptz not null default now()
);
create table public.teams (
 id uuid primary key default gen_random_uuid(), name text not null unique check(char_length(name) between 1 and 40 and name=btrim(name)),
 captain_id uuid not null unique references public.players(id), created_at timestamptz not null default now()
);
alter table public.players add constraint players_team_fk foreign key(team_id) references public.teams(id);
create table public.applications (
 id uuid primary key default gen_random_uuid(), player_id uuid not null references public.players(id), team_id uuid not null references public.teams(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 created_at timestamptz not null default now(), processed_at timestamptz
);
create unique index applications_one_pending on public.applications(player_id,team_id) where status='pending';
create index applications_team_status on public.applications(team_id,status);
create index players_name on public.players(name);
create index players_team on public.players(team_id);
create table public.sessions (
 token_hash text primary key, player_id uuid not null references public.players(id), expires_at timestamptz not null default now()+interval '7 days'
);
create index sessions_expiry on public.sessions(expires_at);
alter table public.players enable row level security;
alter table public.teams enable row level security;
alter table public.applications enable row level security;
alter table public.sessions enable row level security;
revoke all on public.players,public.teams,public.applications,public.sessions from anon,authenticated;
grant all on public.players,public.teams,public.applications,public.sessions to service_role;

create function public.registration_actor(p_hash text) returns public.players language plpgsql security definer set search_path=public as $$
declare actor public.players;
begin
 select p.* into actor from public.players p join public.sessions s on s.player_id=p.id where s.token_hash=p_hash and s.expires_at>now();
 if actor.id is null then raise exception 'UNAUTHORIZED'; end if;
 return actor;
end $$;

create function public.register_player(p_name text,p_gender text,p_phone text,p_role text,p_team_name text,p_team_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_team uuid;
begin
 if p_name is null or char_length(btrim(p_name)) not between 1 and 30 or p_gender is null or p_gender not in ('男','女') or p_phone is null or p_phone !~ '^1[3-9][0-9]{9}$' or p_role is null or p_role not in ('captain','player') then raise exception 'INVALID_INPUT'; end if;
 if p_role='captain' and (p_team_name is null or char_length(btrim(p_team_name)) not between 1 and 40) then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from public.players where phone=p_phone) then raise exception 'PHONE_EXISTS'; end if;
 if p_role='captain' and exists(select 1 from public.teams where name=btrim(p_team_name)) then raise exception 'TEAM_EXISTS'; end if;
 if p_role='player' and p_team_id is not null and not exists(select 1 from public.teams where id=p_team_id) then raise exception 'TEAM_NOT_FOUND'; end if;
 insert into public.players(name,gender,phone,role,team_id) values(btrim(p_name),p_gender,p_phone,p_role,case when p_role='player' then p_team_id else null end) returning id into v_id;
 if p_role='captain' then
  insert into public.teams(name,captain_id) values(btrim(p_team_name),v_id) returning id into v_team;
  update public.players set team_id=v_team where id=v_id;
 end if;
 return jsonb_build_object('id',v_id);
exception when unique_violation then
 if exists(select 1 from public.players where phone=p_phone) then raise exception 'PHONE_EXISTS'; else raise exception 'TEAM_EXISTS'; end if;
end $$;

create function public.login_player(p_name text,p_phone text,p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_ids uuid[]; n integer;
begin
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

create function public.registration_public_teams() returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by created_at,id),'[]'::jsonb) from public.teams;
$$;

create function public.registration_snapshot(p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.players; result jsonb;
begin
 actor:=public.registration_actor(p_hash);
 select jsonb_build_object(
  'viewer',jsonb_build_object('id',actor.id,'name',actor.name,'gender',actor.gender,'role',actor.role,'teamId',actor.team_id),
  'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'captainId',t.captain_id,'captainPhone',c.phone,
   'players',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'gender',p.gender,'role',p.role,'teamId',p.team_id) order by (p.id=t.captain_id) desc,p.created_at,p.id),'[]'::jsonb) from public.players p where p.team_id=t.id)) order by (t.id=actor.team_id) desc nulls last,t.created_at,t.id),'[]'::jsonb) from public.teams t join public.players c on c.id=t.captain_id),
  'freePlayers',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'gender',p.gender,'role',p.role,'teamId',p.team_id) order by p.created_at,p.id),'[]'::jsonb) from public.players p where p.team_id is null and p.role='player'),
  'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'playerId',a.player_id,'teamId',a.team_id,'name',p.name,'gender',p.gender,'teamName',t.name,'status',a.status,'createdAt',a.created_at) order by a.created_at desc,a.id),'[]'::jsonb) from public.applications a join public.players p on p.id=a.player_id join public.teams t on t.id=a.team_id where (actor.role='captain' and t.captain_id=actor.id) or a.player_id=actor.id)
 ) into result;
 return result;
end $$;

create function public.registration_action(p_hash text,p_action text,p_team_id uuid default null,p_player_id uuid default null,p_application_id uuid default null) returns void language plpgsql security definer set search_path=public as $$
declare actor public.players; target public.players; app public.applications; v_team uuid; v_player uuid;
begin
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
 if p_action='recruit' then v_team:=p_team_id; v_player:=p_player_id;
 elsif p_action in ('approve','reject') then
  select * into app from public.applications where id=p_application_id;
  if app.id is null then raise exception 'APPLICATION_CLOSED'; end if;
  v_team:=app.team_id; v_player:=app.player_id;
 else raise exception 'INVALID_INPUT'; end if;
 if not exists(select 1 from public.teams where id=v_team and captain_id=actor.id) then raise exception 'FORBIDDEN'; end if;
 -- Every membership change locks the same player before any application rows.
 select * into target from public.players where id=v_player for update;
 if target.id is null then raise exception 'NOT_FOUND'; end if;
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

create function public.logout_player(p_hash text) returns void language sql security definer set search_path=public as $$
 delete from public.sessions where token_hash=p_hash;
$$;
revoke all on function public.registration_actor(text), public.register_player(text,text,text,text,text,uuid),public.login_player(text,text,text),public.registration_public_teams(),public.registration_snapshot(text),public.registration_action(text,text,uuid,uuid,uuid),public.logout_player(text) from public,anon,authenticated;
grant execute on function public.register_player(text,text,text,text,text,uuid),public.login_player(text,text,text),public.registration_public_teams(),public.registration_snapshot(text),public.registration_action(text,text,uuid,uuid,uuid),public.logout_player(text) to service_role;
commit;

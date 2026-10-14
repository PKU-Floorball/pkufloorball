begin;
alter table public.player_notifications add column if not exists message text;

-- Called only inside the authorized, serialized administrator transaction.
create or replace function public.registration_notify_admin_roster(before_roster jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare changed record; recipient uuid; subject text; message_text text;
begin
 for changed in
  select coalesce(p.id,b.id) as player_id, coalesce(p.name,b.name) as player_name,
   b.team_id as old_team_id,b.team_name as old_team_name,b.captain_id as old_captain_id,b.role as old_role,
   p.team_id as new_team_id,t.name as new_team_name,t.captain_id as new_captain_id,p.role as new_role,
   p.id is null as deleted
  from jsonb_to_recordset(before_roster) as b(id uuid,name text,team_id uuid,team_name text,captain_id uuid,role text)
  full join public.players p on p.id=b.id
  left join public.teams t on t.id=p.team_id
  where b.team_id is distinct from p.team_id or b.role is distinct from p.role
 loop
  -- A newly registered free player has no team change to report.
  if changed.old_role is null and changed.new_team_id is null then continue; end if;
  for recipient in
   select distinct p.id from public.players p
   where p.id in (changed.player_id,changed.old_captain_id,changed.new_captain_id)
  loop
   subject := case when recipient=changed.player_id then '您' else '「'||changed.player_name||'」' end;
   if changed.deleted then
    message_text := '管理员删除了'||subject||'的报名信息，已从「'||changed.old_team_name||'」移出。';
   elsif changed.old_team_id is distinct from changed.new_team_id then
    if changed.new_team_id is null then
     message_text := '管理员将'||subject||'移出了「'||changed.old_team_name||'」，现为自由球员';
    elsif changed.old_team_id is null then
     message_text := '管理员将'||subject||'加入了「'||changed.new_team_name||'」';
    else
     message_text := '管理员将'||subject||'从「'||changed.old_team_name||'」调整至「'||changed.new_team_name||'」';
    end if;
    if changed.new_role='captain' then message_text := message_text||'，并设为队长'; end if;
    message_text := message_text||'。';
   else
    message_text := case when changed.new_role='captain'
     then '管理员将'||subject||'设为「'||changed.new_team_name||'」的队长。'
     else '管理员将'||subject||'在「'||changed.new_team_name||'」的身份由队长调整为队员。' end;
   end if;
   insert into public.player_notifications(player_id,actor_name,team_name,message)
   values(recipient,'管理员',coalesce(changed.new_team_name,changed.old_team_name,''),message_text);
  end loop;
 end loop;
end $$;
revoke all on function public.registration_notify_admin_roster(jsonb) from public,anon,authenticated,service_role;

do $$
declare definition text; anchor text := 'lock table public.players,public.teams,public.applications in share row exclusive mode;';
begin
 definition := pg_get_functiondef('public.registration_admin_action(text,jsonb)'::regprocedure);
 if position('registration_notify_admin_roster' in definition)=0 then
  if position(anchor in definition)=0 or position('declare v_action' in definition)=0 or position('exception when unique_violation' in definition)=0 then
   raise exception 'Unexpected administrator function definition';
  end if;
  definition := replace(definition,'declare v_action','declare before_roster jsonb; v_action');
  definition := replace(definition,anchor,anchor || $patch$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'team_id',p.team_id,'team_name',t.name,'captain_id',t.captain_id)),'[]'::jsonb)
 into before_roster from public.players p left join public.teams t on t.id=p.team_id;
 $patch$);
  definition := replace(definition,'exception when unique_violation', 'perform public.registration_notify_admin_roster(before_roster); exception when unique_violation');
  execute definition;
 end if;
 definition := pg_get_functiondef('public.registration_snapshot(text)'::regprocedure);
 if position('''message'',n.message' in definition)=0 then
  if position('''actorName'',n.actor_name' in definition)=0 then raise exception 'Unexpected snapshot definition'; end if;
  definition := replace(definition,'''actorName'',n.actor_name','''message'',n.message,''actorName'',n.actor_name');
  execute definition;
 end if;
end $$;
commit;

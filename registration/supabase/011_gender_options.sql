-- Expand only gender validation; preserve registration, locks and permissions.
begin;
alter table public.players drop constraint if exists players_gender_check;
alter table public.players add constraint players_gender_check
  check(gender in ('男','女','非二元性别','不愿意透露'));
do $$
declare target regprocedure; definition text;
begin
  foreach target in array array[
    'public.register_player(text,text,text,text,text,uuid)'::regprocedure,
    'public.register_person(text,text,text)'::regprocedure,
    'public.registration_admin_action(text,jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    if position('(''男'',''女'')' in definition) > 0 then
      execute replace(definition, '(''男'',''女'')', '(''男'',''女'',''非二元性别'',''不愿意透露'')');
    elsif position('''非二元性别''' in definition) = 0 then
      raise exception 'Unexpected gender validation in %', target;
    end if;
  end loop;
end $$;
commit;

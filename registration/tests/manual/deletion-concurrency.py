# -*- coding: utf-8 -*-
# Opt-in integration check: deletion and login serialize in real PostgreSQL.
import subprocess,secrets,time,os
project_ref=os.environ['SUPABASE_TEST_PROJECT_REF']
if len(project_ref)!=20 or not project_ref.isalpha(): raise SystemExit('Invalid project ref')
name='删除并发'+secrets.token_hex(4);phone='198'+str(secrets.randbelow(100000000)).zfill(8)
old=secrets.token_hex(32);new=secrets.token_hex(32);admin=secrets.token_hex(32)
cmd=['npm','exec','--yes','--package=supabase','--','supabase','db','query','--linked','--project-ref',project_ref,'--agent','no']
def run(sql):return subprocess.run(cmd+[sql],capture_output=True,text=True)
try:
    assert run(f"select register_person('{name}','男','{phone}','北京大学');select login_player('{name}',null,'{old}');select registration_admin_login('{admin}');").returncode==0,'setup failed'
    # Pause exactly in the gap between session cleanup and player deletion.
    a=f"begin;lock table public.players,public.teams,public.applications in share row exclusive mode;delete from sessions where player_id in(select id from players where name='{name}');select pg_sleep(5);select registration_admin_action('{admin}',jsonb_build_object('action','delete_player','playerId',(select id from players where name='{name}')));commit;"
    p=subprocess.Popen(cmd+[a],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    time.sleep(2)
    r=run(f"select login_player('{name}',null,'{new}');")
    out,err=p.communicate(timeout=60)
    assert p.returncode==0,'deletion rolled back'
    assert r.returncode!=0 and 'NOT_FOUND' in r.stdout+r.stderr,'concurrent login recreated a session'
    print('PASS: deletion commits and concurrent login cannot recreate a deleted identity')
finally:
    cleanup=f"begin;lock table public.players,public.teams,public.applications in share row exclusive mode;delete from sessions where player_id in(select id from players where name='{name}');delete from players where name='{name}';delete from admin_sessions where token_hash='{admin}';commit;"
    assert run(cleanup).returncode==0,'cleanup failed'

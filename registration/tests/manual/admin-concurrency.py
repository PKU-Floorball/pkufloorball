# Manual integration check against a Supabase test project. Requires an authenticated Supabase CLI.
# Creates isolated fixtures, runs two real PostgreSQL transactions, then removes only those fixtures.
import subprocess,json,secrets,time,os
project_ref=os.environ["SUPABASE_TEST_PROJECT_REF"]
if len(project_ref)!=20 or not project_ref.isalpha(): raise SystemExit("Invalid project ref")
prefix='并发测试'+secrets.token_hex(4);cap=prefix+'旧队长';new=prefix+'新队长';member=prefix+'队员';team=prefix+'队';admin=secrets.token_hex(32);captoken=secrets.token_hex(32)
cmd=['npm','exec','--yes','--package=supabase','--','supabase','db','query','--linked','--project-ref',project_ref,'--agent','no']
def run(sql):return subprocess.run(cmd+[sql],capture_output=True,text=True)
phones=['198'+str(secrets.randbelow(100000000)).zfill(8) for _ in range(3)]
setup=f"select register_player('{cap}','男','{phones[0]}','captain','{team}',null);select register_player('{new}','男','{phones[1]}','player',null,null);select register_player('{member}','男','{phones[2]}','player',null,null);select login_player('{cap}',null,'{captoken}');select registration_admin_login('{admin}');"
r=run(setup);assert r.returncode==0,'setup failed'
a=f"begin;lock table public.players,public.teams,public.applications in share row exclusive mode;select pg_sleep(3);select registration_admin_action('{admin}',jsonb_build_object('action','set_captain','teamId',(select id from teams where name='{team}'),'playerId',(select id from players where name='{new}')));commit;"
b=f"select registration_action('{captoken}','recruit',(select id from teams where name='{team}'),(select id from players where name='{member}'),null);"
p=subprocess.Popen(cmd+[a],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);time.sleep(1);r=run(b);out,err=p.communicate();assert p.returncode==0,'admin change failed'
passed=r.returncode!=0 and 'FORBIDDEN' in (r.stdout+r.stderr)
cleanup=f"begin;delete from sessions where player_id in(select id from players where name in('{cap}','{new}','{member}'));delete from admin_sessions where token_hash='{admin}';update players set team_id=null where name in('{cap}','{new}','{member}');delete from teams where name='{team}';delete from players where name in('{cap}','{new}','{member}');commit;"
assert run(cleanup).returncode==0,'cleanup failed'
print('PASS: demoted captain rejected after concurrent admin replacement' if passed else 'FAIL: stale captain authorization allowed concurrent recruitment')
raise SystemExit(0 if passed else 1)

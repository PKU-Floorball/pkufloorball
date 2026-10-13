import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseRegistration } from '../src/lib/validation';
it('all four genders survive registration, login and admin editing without changing permissions',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const dir=new URL('../supabase/',import.meta.url);
  for(const file of readdirSync(dir).filter(f=>/^\d+.*\.sql$/.test(f)).sort())await db.exec(readFileSync(new URL(file,dir),'utf8'));
  await db.exec(readFileSync(new URL('011_gender_options.sql',dir),'utf8')); // repeat safely
  await db.query("select registration_admin_login('admin')");
  for(const [index,gender] of ['男','女','非二元性别','不愿意透露'].entries()){
   const input=parseRegistration({name:`选手${index}`,gender,phone:`1380013800${index}`,school:'北京大学'});
   const r=await db.query<{result:{id:string}}>('select register_person($1,$2,$3,$4) result',[input.name,input.gender,input.phone,input.school]);
   await db.query('select login_player($1,null,$2)',[input.name,`session${index}`]);
   const snap=await db.query<{result:{viewer:{gender:string,teamId:null,role:string}}}>('select registration_snapshot($1) result',[`session${index}`]);
   expect(snap.rows[0].result.viewer).toMatchObject({gender,role:'player',teamId:null});
   await db.query('select registration_admin_action($1,$2::jsonb)',['admin',JSON.stringify({action:'edit_player',playerId:r.rows[0].result.id,...input,gender:'不愿意透露'})]);
   const edited=await db.query<{gender:string}>('select gender from players where id=$1',[r.rows[0].result.id]);expect(edited.rows[0].gender).toBe('不愿意透露');
  }
  await expect(db.query("select register_person('错误','other','13800138999','北京大学')")).rejects.toThrow('INVALID_INPUT');
  await db.exec('set role anon');
  await expect(db.query("select register_person('匿名','男','13800138999','北京大学')")).rejects.toThrow(/permission denied/);
 }finally{await db.close()}
});

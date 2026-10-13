import {expect,it} from "vitest";
import {createDemoStore} from "../src/lib/demo-store";
import {parseAction} from "../src/lib/validation";
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
it("validates self exit, switch source team and optional reason",()=>{
  expect(parseAction({action:"leave_team",teamId:a})).toEqual({action:"leave_team",teamId:a});
  expect(parseAction({action:"switch_apply",teamId:b,sourceTeamId:a,reason:" 想加入训练 "})).toMatchObject({reason:"想加入训练",sourceTeamId:a});
  expect(parseAction({action:"apply",teamId:b,reason:"  "})).toMatchObject({reason:""});
  for(const input of [{action:"leave_team"},{action:"switch_apply",teamId:b},{action:"apply",teamId:b,reason:7},{action:"apply",teamId:b,reason:"字".repeat(501)}])expect(()=>parseAction(input)).toThrow("INVALID_INPUT");
});
it("demo switches atomically and preserves reason, identity, approval workflow",async()=>{
  const s=createDemoStore();await s.login("王子安","0003","m");await s.login("周悦","0002","c");
  const d=await s.snapshot("m"),target=d.teams.find(t=>t.id!==d.viewer.teamId)!;
  await expect(s.act("m",{action:"switch_apply",teamId:target.id,sourceTeamId:target.id} as any)).rejects.toThrow("PLAYER_NOT_IN_TEAM");
  expect((await s.snapshot("m")).viewer.teamId).toBe(d.viewer.teamId);
  await s.act("m",{action:"switch_apply",teamId:target.id,sourceTeamId:d.viewer.teamId!,reason:"一起上场"} as any);
  const changed=await s.snapshot("m");expect(changed.viewer).toMatchObject({id:d.viewer.id,teamId:null});expect(changed.applications[0]).toMatchObject({reason:"一起上场",status:"pending"});
  await s.act("c",{action:"approve",applicationId:changed.applications[0].id});
  await s.act("m",{action:"leave_team",teamId:target.id} as any);expect((await s.snapshot("m")).viewer.teamId).toBeNull();
  await expect(s.act("c",{action:"leave_team",teamId:target.id} as any)).rejects.toThrow("CAPTAIN_CONFLICT");
});

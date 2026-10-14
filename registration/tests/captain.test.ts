import { expect, it } from "vitest";
import { createDemoStore } from "../src/lib/demo-store";
import { parseAction } from "../src/lib/validation";
it("requires own team and successor for captain handoff", () => {
  const teamId="11111111-1111-4111-8111-111111111111", playerId="22222222-2222-4222-8222-222222222222";
  for(const action of ["transfer_captain","leave_captain"]) {
    expect(parseAction({action,teamId,playerId}).action).toBe(action);
    expect(() => parseAction({action,teamId})).toThrow();
    expect(() => parseAction({action,playerId})).toThrow();
  }
  expect(parseAction({action:"dissolve_team",teamId}).action).toBe("dissolve_team");
  expect(() => parseAction({action:"dissolve_team"})).toThrow();
});
it("demo hands off authority, leaves and dissolves with identities preserved", async () => {
  const store=createDemoStore();
  await store.login("陈宇","0001","old"); await store.login("王子安","0003","next");
  const original=await store.snapshot("old"), next=(await store.snapshot("next")).viewer;
  await expect(store.act("old",{action:"leave_captain",teamId:original.viewer.teamId!,playerId:original.freePlayers[0].id})).rejects.toThrow("INVALID_SUCCESSOR");
  await store.act("old",{action:"transfer_captain",teamId:original.viewer.teamId!,playerId:next.id});
  expect((await store.snapshot("old")).viewer.role).toBe("player");
  await expect(store.act("old",{action:"dissolve_team",teamId:original.viewer.teamId!})).rejects.toThrow("FORBIDDEN");
  await store.act("next",{action:"leave_captain",teamId:original.viewer.teamId!,playerId:original.viewer.id});
  expect((await store.snapshot("next")).viewer.teamId).toBeNull();
  await store.act("old",{action:"dissolve_team",teamId:original.viewer.teamId!});
  expect((await store.snapshot("old")).viewer.teamId).toBeNull();
  expect((await store.snapshot("old")).teams.some(t=>t.id===original.viewer.teamId)).toBe(false);
});

it("validates captain team names and keeps demo renaming scoped to the owning captain", async () => {
  const teamId="11111111-1111-4111-8111-111111111111";
  expect(parseAction({action:"rename_team",teamId,name:" 新名字 "}).name).toBe("新名字");
  for (const name of ["", "  ", "名".repeat(41)]) expect(()=>parseAction({action:"rename_team",teamId,name})).toThrow();
  expect(()=>parseAction({action:"rename_team",name:"新名字"})).toThrow();
  const store=createDemoStore();
  await store.login("陈宇","0001","captain");
  await store.login("王子安","0003","member");
  const state=await store.snapshot("captain");
  const own=state.viewer.teamId!;
  const other=state.teams.find(t=>t.id!==own)!;
  await expect(store.act("member",{action:"rename_team",teamId:own,name:"非法"})).rejects.toThrow("FORBIDDEN");
  await expect(store.act("captain",{action:"rename_team",teamId:other.id,name:"非法"})).rejects.toThrow("FORBIDDEN");
  await expect(store.act("captain",{action:"rename_team",teamId:own,name:other.name})).rejects.toThrow("TEAM_EXISTS");
  await store.act("captain",{action:"rename_team",teamId:own,name:"新队名"});
  expect((await store.snapshot("captain")).teams.find(t=>t.id===own)!.name).toBe("新队名");
});

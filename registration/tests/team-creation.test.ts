import { expect, it } from "vitest";
import { createDemoStore } from "../src/lib/demo-store";
it("demo registration ignores old membership fields and creates teams only from free agents", async () => {
  const store = createDemoStore();
  await store.register({
    name: "新人",
    gender: "男",
    phone: "13800138400",
    school: "北京大学",
    role: "captain",
    teamName: "旧注册队",
  } as any);
  await store.login("新人", null, "n");
  const initial = await store.snapshot("n");
  expect(initial.viewer).toMatchObject({ role: "player", teamId: null });
  const member = initial.freePlayers.find((p) => p.name === "林夏")!;
  await (store as any).createTeam("n", {
    name: "新队",
    memberIds: [member.id],
  });
  const data = await store.snapshot("n");
  expect(data.viewer.role).toBe("captain");
  expect(
    data.teams.find((t) => t.name === "新队")?.players.map((p) => p.name),
  ).toEqual(["新人", "林夏"]);
});

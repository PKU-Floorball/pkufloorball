import { expect, it } from "vitest";
import { createDemoStore } from "../src/lib/demo-store";
import { parseAction } from "../src/lib/validation";

it("accepts removal only with both a target team and player", () => {
  const teamId = "11111111-1111-4111-8111-111111111111",
    playerId = "22222222-2222-4222-8222-222222222222";
  expect(parseAction({ action: "remove", teamId, playerId })).toEqual({
    action: "remove",
    teamId,
    playerId,
  });
  expect(() => parseAction({ action: "remove", teamId })).toThrow();
  expect(() => parseAction({ action: "remove", playerId })).toThrow();
});
it("demo removal keeps player identity and lets them apply again as a free agent", async () => {
  const store = createDemoStore();
  await store.login("陈宇", null, "c");
  await store.login("王子安", null, "p");
  const original = await store.snapshot("p");
  await store.act("c", {
    action: "remove",
    teamId: original.viewer.teamId!,
    playerId: original.viewer.id,
  });
  const updated = await store.snapshot("p");
  expect(updated.viewer.id).toBe(original.viewer.id);
  expect(updated.viewer.teamId).toBeNull();
  expect(updated.freePlayers.some((p) => p.id === original.viewer.id)).toBe(
    true,
  );
  expect(
    updated.teams
      .flatMap((t) => t.players)
      .some((p) => p.id === original.viewer.id),
  ).toBe(false);
  await store.act("p", { action: "apply", teamId: original.viewer.teamId! });
  expect((await store.snapshot("p")).applications[0].status).toBe("pending");
});
it("demo rejects removing the captain, another team member or an already free player", async () => {
  const store = createDemoStore();
  await store.login("陈宇", null, "c");
  await store.login("周悦", null, "other");
  await store.login("王子安", null, "p");
  const data = await store.snapshot("c"),
    own = data.teams.find((t) => t.id === data.viewer.teamId)!;
  const other = data.teams.find((t) => t.id !== data.viewer.teamId)!;
  await expect(
    store.act("c", {
      action: "remove",
      teamId: own.id,
      playerId: data.viewer.id,
    }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    store.act("other", {
      action: "remove",
      teamId: own.id,
      playerId: own.players[1].id,
    }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    store.act("c", {
      action: "remove",
      teamId: own.id,
      playerId: other.players[1].id,
    }),
  ).rejects.toThrow("PLAYER_NOT_IN_TEAM");
  await expect(
    store.act("p", {
      action: "remove",
      teamId: own.id,
      playerId: own.players[1].id,
    }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    store.act("c", {
      action: "remove",
      teamId: own.id,
      playerId: data.freePlayers[0].id,
    }),
  ).rejects.toThrow("PLAYER_NOT_IN_TEAM");
});

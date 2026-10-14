import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
let db: PGlite;
async function register(
  name: string,
  phone: string,
  role = "player",
  teamName: string | null = null,
  teamId: string | null = null,
) {
  const rows = await db.query<{ result: { id: string } }>(
    "select register_player($1,$2,$3,$4,$5,$6) as result",
    [name, "男", phone, role, teamName, teamId],
  );
  return rows.rows[0].result.id;
}
async function login(name: string, token: string, phone: string | null = null) {
  const result = await db.query<{ result: unknown }>(
    "select login_player($1,$2,$3) as result",
    [name, phone, token],
  );
  return result.rows[0].result;
}
async function teams() {
  return (
    await db.query<{ id: string; name: string }>(
      "select id,name from teams order by name",
    )
  ).rows;
}
async function act(
  token: string,
  action: string,
  team: string | null = null,
  player: string | null = null,
  application: string | null = null,
) {
  return db.query("select registration_action($1,$2,$3,$4,$5)", [
    token,
    action,
    team,
    player,
    application,
  ]);
}
async function snapshot(token: string) {
  return (
    await db.query<{ result: any }>(
      "select registration_snapshot($1) as result",
      [token],
    )
  ).rows[0].result;
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role;",
  );
  await db.exec(
    readFileSync(
      new URL("../supabase/001_registration.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("../supabase/002_remove_member.sql", import.meta.url),
      "utf8",
    ),
  );
  const adminMigration = new URL("../supabase/003_admin.sql", import.meta.url);
  {
    await db.exec(readFileSync(adminMigration, "utf8"));
    await db.exec(
      readFileSync(
        new URL("../supabase/004_admin_serialization.sql", import.meta.url),
        "utf8",
      ),
    );
  }
  await db.exec(
    readFileSync(
      new URL("../supabase/005_admin_create_captain.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/006_personal_registration_and_team_creation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(readFileSync(new URL("../supabase/007_captain_management.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/008_duplicate_registration_and_player_deletion.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/009_school_information.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/010_member_exit_and_application_reasons.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/011_gender_options.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/012_recruitment_notifications.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/013_captain_team_name.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/014_admin_roster_notifications.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/015_message_read_receipts.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/016_self_profile.sql", import.meta.url), "utf8"));
});
afterEach(async () => {
  await db.close();
});
describe("database registration and name sessions", () => {
  it("creates a captain, direct team member and free agent with private phone numbers", async () => {
    const captain = await register("队长", "13800138000", "captain", "未名队");
    const team = (await teams())[0].id;
    await register("队员", "13800138001", "player", null, team);
    await register("自由", "13800138002");
    await login("队长", "captain-token");
    const data = await snapshot("captain-token");
    expect(data.teams[0].players.map((p: any) => p.name)).toEqual([
      "队长",
      "队员",
    ]);
    expect(data.teams[0].captainPhone).toBe("13800138000");
    expect(data.teams[0].players[0].id).toBe(captain);
    expect(data.freePlayers.map((p: any) => p.name)).toEqual(["自由"]);
    expect(JSON.stringify(data)).not.toContain("13800138001");
    expect(JSON.stringify(data)).not.toContain("13800138002");
  });
  it("does not create orphan captains on duplicate team names or phone numbers", async () => {
    await register("甲", "13800138000", "captain", "未名队");
    await expect(
      register("乙", "13800138001", "captain", "未名队"),
    ).rejects.toThrow();
    await expect(register("丙", "13800138000")).rejects.toThrow();
    expect((await db.query("select id from players")).rows).toHaveLength(1);
  });
  it("requires phone when names collide and rejects unknown or expired sessions", async () => {
    await register("同名", "13800138000");
    const second = await register("同名", "13800138001");
    await expect(login("同名", "ambiguous")).rejects.toThrow("NEED_PHONE");
    await login("同名", "resolved", "13800138001");
    expect((await snapshot("resolved")).viewer.id).toBe(second);
    await expect(snapshot("unknown")).rejects.toThrow("UNAUTHORIZED");
    await db.exec(
      "update sessions set expires_at = now() - interval '1 second'",
    );
    await expect(snapshot("resolved")).rejects.toThrow("UNAUTHORIZED");
  });
  it("blocks direct table and function access from browser roles", async () => {
    await db.exec("set role anon");
    await expect(db.query("select * from players")).rejects.toThrow();
    await expect(
      db.query(
        "select register_player('甲','男','13800138000','player',null,null)",
      ),
    ).rejects.toThrow();
  });
});
describe("join actions", () => {
  it("approves one request, cancels competing requests and blocks repeated recruitment", async () => {
    await register("甲队长", "13800138000", "captain", "甲队");
    await register("乙队长", "13800138001", "captain", "乙队");
    const player = await register("球员", "13800138002");
    await login("甲队长", "a");
    await login("乙队长", "b");
    await login("球员", "p");
    const all = await teams();
    const a = all.find((t) => t.name === "甲队")!,
      b = all.find((t) => t.name === "乙队")!;
    await act("p", "apply", a.id);
    await act("p", "apply", b.id);
    await expect(act("p", "apply", a.id)).rejects.toThrow(
      "DUPLICATE_APPLICATION",
    );
    const application = (await snapshot("a")).applications[0].id;
    await expect(act("b", "approve", null, null, application)).rejects.toThrow(
      "FORBIDDEN",
    );
    await act("a", "approve", null, null, application);
    const data = await snapshot("p");
    expect(data.viewer.teamId).toBe(a.id);
    expect(data.notifications).toEqual([]);
    expect(data.applications.map((r: any) => r.status).sort()).toEqual([
      "approved",
      "cancelled",
    ]);
    const competing = (await snapshot("b")).applications[0];
    expect(competing.status).toBe("cancelled");
    await expect(act("b", "approve", null, null, competing.id)).rejects.toThrow("APPLICATION_CLOSED");
    await expect(act("b", "recruit", b.id, player)).rejects.toThrow(
      "ALREADY_JOINED",
    );
    await expect(act("a", "approve", null, null, application)).rejects.toThrow(
      "APPLICATION_CLOSED",
    );
  });
  it("rejects without joining and permits a later application", async () => {
    await register("队长", "13800138000", "captain", "未名队");
    await register("球员", "13800138001");
    await login("队长", "c");
    await login("球员", "p");
    const team = (await teams())[0].id;
    await act("p", "apply", team);
    const app = (await snapshot("c")).applications[0].id;
    await act("c", "reject", null, null, app);
    expect((await snapshot("p")).viewer.teamId).toBeNull();
    await act("p", "apply", team);
    expect(
      (await snapshot("p")).applications.map((a: any) => a.status).sort(),
    ).toEqual(["pending", "rejected"]);
  });
  it("recruits only to the captain own team and prevents player or anonymous actions", async () => {
    await db.exec(readFileSync(new URL("../supabase/012_recruitment_notifications.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/013_captain_team_name.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/014_admin_roster_notifications.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/015_message_read_receipts.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/016_self_profile.sql", import.meta.url), "utf8"));
    await register("队长", "13800138000", "captain", "未名队");
    const player = await register("球员", "13800138001");
    await login("队长", "c");
    await login("球员", "p");
    const team = (await teams())[0].id;
    await expect(act("p", "recruit", team, player)).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(act("invalid", "recruit", team, player)).rejects.toThrow(
      "UNAUTHORIZED",
    );
    await act("c", "recruit", team, player);
    const joined = await snapshot("p");
    expect(joined.viewer.teamId).toBe(team);
    expect(joined.notifications).toEqual([expect.objectContaining({ actorName: "队长", teamName: "未名队" })]);
    expect(joined.applications).toEqual([]);
    expect((await snapshot("c")).notifications).toEqual([]);
    await expect(act("c", "recruit", team, player)).rejects.toThrow("ALREADY_JOINED");
    expect((await snapshot("p")).notifications).toHaveLength(1);
    await expect(act("p", "apply", team)).rejects.toThrow("ALREADY_JOINED");
  });
});

describe("returning members to free agents", () => {
  it("removes a member without deleting registration or session, then permits reapplication", async () => {
    await register("队长", "13800138000", "captain", "未名队");
    const team = (await teams())[0].id;
    const member = await register("队员", "13800138001", "player", null, team);
    await login("队长", "c");
    await login("队员", "p");
    await act("c", "remove", team, member);
    const data = await snapshot("p");
    expect(data.viewer.id).toBe(member);
    expect(data.viewer.teamId).toBeNull();
    expect(data.freePlayers.map((p: any) => p.id)).toContain(member);
    expect(data.teams[0].players.map((p: any) => p.name)).toEqual(["队长"]);
    expect((await db.query("select id from players")).rows).toHaveLength(2);
    await act("p", "apply", team);
    const application = (await snapshot("c")).applications[0].id;
    await act("c", "approve", null, null, application);
    expect((await snapshot("p")).viewer.teamId).toBe(team);
  });
  it("refuses captain removal, another captain, player or unauthenticated removal", async () => {
    const captain = await register("甲队长", "13800138000", "captain", "甲队");
    await register("乙队长", "13800138001", "captain", "乙队");
    const all = await teams(),
      team = all.find((t) => t.name === "甲队")!.id;
    const member = await register("队员", "13800138002", "player", null, team);
    await login("甲队长", "c");
    await login("乙队长", "other");
    await login("队员", "p");
    await expect(act("c", "remove", team, captain)).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(act("other", "remove", team, member)).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(act("p", "remove", team, member)).rejects.toThrow("FORBIDDEN");
    await expect(act("unknown", "remove", team, member)).rejects.toThrow(
      "UNAUTHORIZED",
    );
    expect((await snapshot("p")).viewer.teamId).toBe(team);
  });
  it("refuses stale removal after the member is free or joins another team", async () => {
    await register("甲队长", "13800138000", "captain", "甲队");
    await register("乙队长", "13800138001", "captain", "乙队");
    const all = await teams(),
      a = all.find((t) => t.name === "甲队")!.id,
      b = all.find((t) => t.name === "乙队")!.id;
    const member = await register("队员", "13800138002", "player", null, a);
    await login("甲队长", "a");
    await login("乙队长", "b");
    await login("队员", "p");
    await act("a", "remove", a, member);
    await expect(act("a", "remove", a, member)).rejects.toThrow(
      "PLAYER_NOT_IN_TEAM",
    );
    await act("b", "recruit", b, member);
    await expect(act("a", "remove", a, member)).rejects.toThrow(
      "PLAYER_NOT_IN_TEAM",
    );
    expect((await snapshot("p")).viewer.teamId).toBe(b);
  });
});

// These tests catch unauthorized writes, orphan captains, and lost membership history.
async function admin(input: Record<string, unknown>, token = "admin") {
  return db.query("select registration_admin_action($1,$2::jsonb)", [
    token,
    JSON.stringify(input),
  ]);
}
async function adminLogin() {
  await db.query("select registration_admin_login('admin')");
}
describe("administrator permissions and roster management", () => {
  it("rejects player sessions, expired admin sessions and browser RPC access", async () => {
    await register("球员", "13800138100");
    await login("球员", "player");
    await expect(admin({ action: "rename_team" }, "player")).rejects.toThrow(
      "UNAUTHORIZED",
    );
    await adminLogin();
    await db.exec(
      "update admin_sessions set expires_at=now()-interval '1 second'",
    );
    await expect(admin({ action: "rename_team" })).rejects.toThrow(
      "UNAUTHORIZED",
    );
    await db.exec("set role anon");
    await expect(
      db.query("select registration_admin_login('forged')"),
    ).rejects.toThrow();
  });
  it("creates and renames a team, replaces captain and moves members", async () => {
    const old = await register("原队长", "13800138100", "captain", "原队");
    const next = await register("新队长", "13800138101");
    const member = await register("队员", "13800138102");
    const team = (await teams())[0].id;
    await adminLogin();
    await admin({ action: "rename_team", teamId: team, name: "新队名" });
    await admin({ action: "set_captain", teamId: team, playerId: next });
    const rows = (await db.query<any>("select id,role,team_id from players"))
      .rows;
    expect(rows.find((p) => p.id === old).role).toBe("player");
    expect(rows.find((p) => p.id === next)).toMatchObject({
      role: "captain",
      team_id: team,
    });
    await admin({ action: "create_team", name: "第二队", playerId: member });
    const second = (await teams()).find((t) => t.name === "第二队")!.id;
    await admin({ action: "move_player", playerId: old, teamId: second });
    await expect(
      admin({ action: "move_player", playerId: next, teamId: second }),
    ).rejects.toThrow("CAPTAIN_CONFLICT");
    await admin({ action: "move_player", playerId: old, teamId: null });
    expect(
      (await db.query<any>("select team_id from players where id=$1", [old]))
        .rows[0].team_id,
    ).toBeNull();
    expect((await teams()).find((t) => t.id === team)?.name).toBe("新队名");
  });
  it("edits players and deletes a team without losing registrations", async () => {
    const cap = await register("队长", "13800138100", "captain", "测试队");
    const team = (await teams())[0].id;
    const member = await register("队员", "13800138101", "player", null, team);
    await adminLogin();
    await admin({
      action: "edit_player",
      playerId: member,
      name: "新名字",
      gender: "女",
      phone: "13800138103",
      school: "北京大学",
    });
    await admin({
      action: "create_player",
      name: "新增",
      gender: "男",
      phone: "13800138104",
      school: "北京大学",
      teamId: team,
    });
    await admin({ action: "delete_team", teamId: team });
    expect(await teams()).toHaveLength(0);
    const rows = (await db.query<any>("select * from players")).rows;
    expect(rows).toHaveLength(3);
    expect(rows.every((p) => p.team_id === null && p.role === "player")).toBe(
      true,
    );
    expect(rows.find((p) => p.id === member)).toMatchObject({
      name: "新名字",
      gender: "女",
      phone: "13800138103",
      school: "北京大学",
    });
    expect(rows.find((p) => p.id === cap).role).toBe("player");
  });
  it("handles any team's applications and cancels requests after transfer", async () => {
    await register("队长", "13800138100", "captain", "队");
    const team = (await teams())[0].id;
    const member = await register("队员", "13800138101");
    await login("队员", "p");
    await act("p", "apply", team);
    await adminLogin();
    let application = (await snapshot("p")).applications[0].id;
    await admin({ action: "reject", applicationId: application });
    await act("p", "apply", team);
    application = (await snapshot("p")).applications.find(
      (a: any) => a.status === "pending",
    ).id;
    await admin({ action: "approve", applicationId: application });
    expect((await snapshot("p")).viewer.teamId).toBe(team);
    await admin({ action: "move_player", playerId: member, teamId: null });
    await act("p", "apply", team);
    await admin({ action: "move_player", playerId: member, teamId: team });
    expect(
      (await snapshot("p")).applications.some(
        (a: any) => a.status === "pending",
      ),
    ).toBe(false);
  });
});

async function createTeam(token: string, name: string, ids: string[] = []) {
  return db.query("select registration_create_team($1,$2,$3::uuid[])", [
    token,
    name,
    ids,
  ]);
}
it("personal registration always starts as a free agent", async () => {
  await db.query("select register_person('新人','女','13800138300','北京大学')");
  await login("新人", "p");
  expect((await snapshot("p")).viewer).toMatchObject({
    name: "新人",
    role: "player",
    teamId: null,
  });
  expect(await teams()).toHaveLength(0);
});
it("free agents create a team and selected free members join atomically with pending requests cancelled", async () => {
  await register("旧队长", "13800138300", "captain", "已有队");
  const oldTeam = (await teams())[0].id;
  const cap = await register("创建者", "13800138301"),
    member = await register("伙伴", "13800138302"),
    other = await register("未选", "13800138303");
  await login("创建者", "c");
  await login("伙伴", "p");
  await act("c", "apply", oldTeam);
  await act("p", "apply", oldTeam);
  await createTeam("c", "新球队", [member]);
  const data = await snapshot("c"),
    team = data.teams.find((t: any) => t.name === "新球队");
  expect(data.viewer).toMatchObject({ role: "captain", teamId: team.id });
  expect(team.players.map((p: any) => p.id)).toEqual([cap, member]);
  expect(data.freePlayers.map((p: any) => p.id)).toContain(other);
  expect(
    (await db.query<any>("select status from applications")).rows.every(
      (a) => a.status === "cancelled",
    ),
  ).toBe(true);
});
it("stale selections, duplicate names and non-free creators cannot leave partial new teams", async () => {
  await register("队长", "13800138300", "captain", "占用队");
  const team = (await teams())[0].id;
  const taken = await register("已入队", "13800138301", "player", null, team),
    free = await register("自由", "13800138302"),
    cap = await register("创建者", "13800138303");
  await login("创建者", "c");
  await login("已入队", "taken");
  await expect(createTeam("c", "不应出现", [free, taken])).rejects.toThrow(
    "PLAYER_UNAVAILABLE",
  );
  await expect(createTeam("c", "占用队", [free])).rejects.toThrow(
    "TEAM_EXISTS",
  );
  await expect(createTeam("taken", "另一个队", [])).rejects.toThrow(
    "ALREADY_JOINED",
  );
  expect(await teams()).toHaveLength(1);
  expect((await snapshot("c")).viewer).toMatchObject({
    role: "player",
    teamId: null,
  });
  await createTeam("c", "成功队", [free]);
  await expect(createTeam("c", "重复创建", [])).rejects.toThrow(
    "ALREADY_JOINED",
  );
});
it("team creation rejects anonymous sessions, repeated members and selecting oneself", async () => {
  const p = await register("创建者", "13800138300"),
    member = await register("伙伴", "13800138301");
  await login("创建者", "p");
  await expect(createTeam("unknown", "队", [])).rejects.toThrow("UNAUTHORIZED");
  await expect(createTeam("p", "队", [member, member])).rejects.toThrow(
    "INVALID_INPUT",
  );
  await expect(createTeam("p", "队", [p])).rejects.toThrow("INVALID_INPUT");
  expect(await teams()).toHaveLength(0);
});

describe("captain succession and dissolution", () => {
  it("transfers authority, then transfers and leaves atomically, preserving sessions", async () => {
    const old = await register("原队长", "13800138900", "captain", "交接队");
    const team = (await teams())[0].id;
    const next = await register("继任", "13800138901", "player", null, team);
    await login("原队长", "old"); await login("继任", "next");
    await act("old", "transfer_captain", team, next);
    expect((await snapshot("old")).viewer).toMatchObject({role:"player",teamId:team});
    expect((await snapshot("next")).teams[0]).toMatchObject({captainId:next,captainPhone:"13800138901"});
    await expect(act("old", "dissolve_team", team)).rejects.toThrow("FORBIDDEN");
    await act("next", "leave_captain", team, old);
    expect((await snapshot("next")).viewer).toMatchObject({role:"player",teamId:null});
    expect((await snapshot("old")).viewer.role).toBe("captain");
    await act("next", "apply", team);
    await act("old", "dissolve_team", team);
    expect((await snapshot("next")).applications).toHaveLength(0);
    expect((await snapshot("old")).teams).toHaveLength(0);
    expect((await snapshot("old")).freePlayers).toHaveLength(2);
  });
  it("rejects invalid or stale successors without partial changes and permits solo dissolution", async () => {
    const old = await register("独自队长", "13800138900", "captain", "独自队");
    const team = (await teams())[0].id;
    const free = await register("自由", "13800138901");
    await login("独自队长", "old"); await login("自由", "free");
    for (const successor of [null, old, free]) {
      await expect(act("old", "leave_captain", team, successor)).rejects.toThrow("INVALID_SUCCESSOR");
      expect((await snapshot("old")).viewer).toMatchObject({role:"captain",teamId:team});
    }
    await expect(act("free", "dissolve_team", team)).rejects.toThrow("FORBIDDEN");
    await act("old", "recruit", team, free);
    await act("old", "remove", team, free);
    await expect(act("old", "transfer_captain", team, free)).rejects.toThrow("INVALID_SUCCESSOR");
    await act("old", "dissolve_team", team);
    expect((await snapshot("old")).viewer).toMatchObject({role:"player",teamId:null});
    await expect(act("old", "dissolve_team", team)).rejects.toThrow("FORBIDDEN");
  });
});

describe("duplicate signup and administrator deletion", () => {
  it("recognizes matching name and phone without changing registration", async () => {
    const id=await register("已报名", "13800138800");
    await expect(db.query("select register_person($1,$2,$3,$4)",[" 已报名 ","女","13800138800","北京大学"])).rejects.toThrow("ALREADY_REGISTERED");
    await expect(db.query("select register_person($1,$2,$3,$4)",["不同姓名","男","13800138800","北京大学"])).rejects.toThrow("PHONE_EXISTS");
    expect((await db.query<any>("select id,name,gender from players")).rows).toEqual([{id,name:"已报名",gender:"男"}]);
  });
  it("deletes free and team players, clears applications and sessions, permits reregistration", async () => {
    await register("队长","13800138800","captain","删除测试队");
    const team=(await teams())[0].id;
    const member=await register("队员","13800138801","player",null,team);
    const free=await register("自由","13800138802");
    await login("队员","member"); await login("自由","free");
    await act("free","apply",team); await adminLogin();
    await admin({action:"delete_player",playerId:free});
    await expect(snapshot("free")).rejects.toThrow("UNAUTHORIZED");
    expect((await db.query("select id from applications")).rows).toHaveLength(0);
    await admin({action:"delete_player",playerId:member});
    await expect(snapshot("member")).rejects.toThrow("UNAUTHORIZED");
    expect((await db.query("select id from players")).rows).toHaveLength(1);
    expect((await db.query("select token_hash from sessions")).rows).toHaveLength(0);
    await db.query("select register_person('队员','女','13800138801','北京大学')");
    await login("队员","again");
    expect((await snapshot("again")).viewer.teamId).toBeNull();
    await expect(admin({action:"delete_player",playerId:member})).rejects.toThrow("NOT_FOUND");
  });
  it("blocks unauthorized deletion and captain deletion without losing data", async () => {
    const captain=await register("队长","13800138800","captain","保护队");
    const member=await register("队员","13800138801");
    await login("队员","player");
    await expect(admin({action:"delete_player",playerId:member},"player")).rejects.toThrow("UNAUTHORIZED");
    await adminLogin();
    await expect(admin({action:"delete_player",playerId:captain})).rejects.toThrow("CAPTAIN_CONFLICT");
    await expect(admin({action:"delete_player"})).rejects.toThrow("NOT_FOUND");
    expect((await teams())).toHaveLength(1);
    expect((await db.query("select id from players")).rows).toHaveLength(2);
    await db.exec("set role anon");
    await expect(admin({action:"delete_player",playerId:member})).rejects.toThrow();
  });
});

it("saves school, exposes it in the lobby and lets administrators edit it",async()=>{
  await db.query("select register_person($1,$2,$3,$4)",["学校选手","女","13800138600"," 北京大学校友 "]);
  await login("学校选手","school");
  let data=await snapshot("school");
  expect(data.viewer.school).toBe("北京大学校友");
  expect(data.freePlayers.find((p:any)=>p.name==="学校选手").school).toBe("北京大学校友");
  await createTeam("school","学校队");
  data=await snapshot("school");expect(data.teams[0].players[0].school).toBe("北京大学校友");
  await adminLogin();
  await admin({action:"edit_player",playerId:data.viewer.id,name:"学校选手",gender:"女",phone:"13800138600",school:"清华大学校友"});
  expect((await snapshot("school")).viewer.school).toBe("清华大学校友");
  const managed=(await db.query<any>("select registration_admin_snapshot('admin') as result")).rows[0].result;
  expect(managed.players[0].school).toBe("清华大学校友");
  for(const school of [null," ","校".repeat(81)]) {
    await expect(db.query("select register_person($1,$2,$3,$4)",["无学校","男","13800138601",school])).rejects.toThrow("INVALID_INPUT");
  }
  await expect(admin({action:"edit_player",playerId:data.viewer.id,name:"学校选手",gender:"女",phone:"13800138600",school:""})).rejects.toThrow("INVALID_INPUT");
  expect((await snapshot("school")).viewer.school).toBe("清华大学校友");
});

it("administrator signups require school and browser/server legacy APIs cannot bypass it",async()=>{
  await adminLogin();
  const signup={name:"管理员学校",gender:"男",phone:"13800138602",school:" 清华大学 "};
  await db.query("select registration_admin_register_person($1,$2::jsonb)",["admin",JSON.stringify(signup)]);
  expect((await db.query<any>("select school from players where name='管理员学校'")).rows[0].school).toBe("清华大学");
  await expect(db.query("select registration_admin_register_person($1,$2::jsonb)",["admin",JSON.stringify({...signup,name:"缺学校",phone:"13800138603",school:""})])).rejects.toThrow("INVALID_INPUT");
  await db.exec("set role service_role");
  await expect(db.query("select register_person('绕过','男','13800138604')")).rejects.toThrow();
  await expect(db.query("select register_player('绕过','男','13800138604','player',null,null)")).rejects.toThrow();
  await db.exec("set role anon");
  await expect(db.query("select register_person('匿名','男','13800138605','北京大学')")).rejects.toThrow();
});

it("members leave themselves and atomically switch to an application with an optional reason",async()=>{
  await register("甲长","13800138700","captain","甲队");await register("乙长","13800138701","captain","乙队");
  const all=await teams(),a=all.find(t=>t.name==="甲队")!.id,b=all.find(t=>t.name==="乙队")!.id;
  const member=await register("换队员","13800138702","player",null,a);
  await login("换队员","m");await login("甲长","a");await login("乙长","b");
  const change=(team:string,source:string,reason:string|null="")=>db.query("select registration_action($1,'switch_apply',$2,null,null,$3,$4)",["m",team,reason,source]);
  await expect(change(b,b)).rejects.toThrow("PLAYER_NOT_IN_TEAM");
  await expect(change(a,a)).rejects.toThrow("INVALID_INPUT");
  await expect(change("00000000-0000-4000-8000-000000000000",a)).rejects.toThrow("TEAM_NOT_FOUND");
  await expect(change(b,a,"字".repeat(501))).rejects.toThrow("INVALID_INPUT");
  expect((await snapshot("m")).viewer.teamId).toBe(a);
  await change(b,a," 想一起训练\n周末有空 ");
  const data=await snapshot("m"),app=data.applications[0];
  expect(data.viewer).toMatchObject({id:member,teamId:null});
  expect(app).toMatchObject({reason:"想一起训练\n周末有空",status:"pending",teamId:b});
  expect((await snapshot("b")).applications[0].reason).toBe(app.reason);
  await adminLogin();expect((await db.query<any>("select registration_admin_snapshot('admin') as result")).rows[0].result.applications[0].reason).toBe(app.reason);
  await act("b","approve",null,null,app.id);
  await expect(act("m","leave_team",a)).rejects.toThrow("PLAYER_NOT_IN_TEAM");
  await act("m","leave_team",b);expect((await snapshot("m")).viewer.teamId).toBeNull();
  await expect(act("a","leave_team",a)).rejects.toThrow("CAPTAIN_CONFLICT");
  await expect(act("unknown","leave_team",a)).rejects.toThrow("UNAUTHORIZED");
  await act("m","apply",a);expect((await snapshot("m")).applications.find((x:any)=>x.status==="pending").reason).toBe("");
});


it("only the current owning captain can rename a team with a valid unique name", async () => {
  await register("甲队长", "13800138001", "captain", "甲队");
  await register("乙队长", "13800138002", "captain", "乙队");
  await register("队员", "13800138003");
  await login("甲队长", "captain");
  await login("乙队长", "other");
  await login("队员", "member");
  const team = (await teams()).find(t => t.name === "甲队")!.id;
  const rename = (token:string, name:string) => db.query("select registration_rename_team($1,$2,$3)",[token,team,name]);
  await expect(rename("member","非法")).rejects.toThrow("FORBIDDEN");
  await expect(rename("other","非法")).rejects.toThrow("FORBIDDEN");
  await expect(rename("captain","乙队")).rejects.toThrow("TEAM_EXISTS");
  await expect(rename("captain","  ")).rejects.toThrow("INVALID_INPUT");
  await expect(rename("captain","名".repeat(41))).rejects.toThrow("INVALID_INPUT");
  await act("member","apply",team);
  await rename("captain"," 新队名 ");
  await rename("captain","新队名");
  expect((await snapshot("member")).applications[0].teamName).toBe("新队名");
  expect((await teams()).find(t=>t.id===team)!.name).toBe("新队名");
  const permissions = await db.query<{allowed:boolean}>("select has_function_privilege('anon','registration_rename_team(text,uuid,text)','execute') as allowed");
  expect(permissions.rows[0].allowed).toBe(false);
});

it("administrator team changes notify the player and both captains atomically, without no-op duplicates", async () => {
  await register("甲队长","13800138901","captain","甲队");
  await register("乙队长","13800138902","captain","乙队");
  const member=await register("队员","13800138903");
  await login("甲队长","a"); await login("乙队长","b"); await login("队员","p");
  await adminLogin();
  const a=(await teams()).find(t=>t.name==="甲队")!.id, b=(await teams()).find(t=>t.name==="乙队")!.id;
  await expect(admin({action:"move_player",playerId:member,teamId:a},"p")).rejects.toThrow("UNAUTHORIZED");
  expect((await snapshot("p")).notifications).toHaveLength(0);
  await admin({action:"move_player",playerId:member,teamId:a});
  expect((await snapshot("p")).notifications[0].message).toBe("管理员将您加入了「甲队」。");
  expect((await snapshot("a")).notifications[0].message).toContain("「队员」");
  expect((await snapshot("b")).notifications).toHaveLength(0);
  await admin({action:"move_player",playerId:member,teamId:b});
  expect((await snapshot("p")).notifications[0].message).toContain("从「甲队」调整至「乙队」");
  expect((await snapshot("a")).notifications).toHaveLength(2);
  expect((await snapshot("b")).notifications).toHaveLength(1);
  await admin({action:"move_player",playerId:member,teamId:b});
  await admin({action:"rename_team",teamId:b,name:"新乙队"});
  expect((await snapshot("p")).notifications).toHaveLength(2);
  await admin({action:"move_player",playerId:member,teamId:null});
  expect((await snapshot("p")).notifications[0].message).toBe("管理员将您移出了「新乙队」，现为自由球员。");
  await db.exec(readFileSync(new URL("../supabase/014_admin_roster_notifications.sql",import.meta.url),"utf8"));
  await admin({action:"move_player",playerId:member,teamId:b});
  expect((await snapshot("p")).notifications).toHaveLength(4);
  await admin({action:"delete_team",teamId:b});
  expect((await snapshot("p")).notifications[0].message).toContain("现为自由球员");
  expect((await snapshot("b")).notifications.some((n:any)=>n.message.includes("「队员」") && n.message.includes("移出"))).toBe(true);
});
it("administrator captain changes notify incoming and outgoing captains and rollback on failure", async () => {
  const old=await register("原队长","13800138911","captain","本队");
  const member=await register("新队长","13800138912");
  await login("原队长","old"); await login("新队长","new"); await adminLogin();
  const team=(await teams())[0].id;
  await admin({action:"set_captain",teamId:team,playerId:member});
  expect((await snapshot("new")).notifications.some((n:any)=>n.message.includes("并设为队长"))).toBe(true);
  expect((await snapshot("old")).notifications.some((n:any)=>n.message.includes("由队长调整为队员"))).toBe(true);
  const count=(await snapshot("new")).notifications.length;
  await expect(admin({action:"move_player",teamId:null,playerId:member})).rejects.toThrow("CAPTAIN_CONFLICT");
  expect((await snapshot("new")).notifications).toHaveLength(count);
  await admin({action:"delete_player",playerId:old});
  expect((await snapshot("new")).notifications[0].message).toContain("删除了「原队长」");
});

it("administrator approvals and team creation deliver private notifications and keep the internal helper inaccessible", async () => {
  await register("队长","13800138921","captain","原队");
  const member=await register("球员","13800138922");
  await login("队长","c"); await login("球员","p"); await adminLogin();
  const team=(await teams())[0].id;
  await act("p","apply",team);
  const application=(await snapshot("p")).applications[0].id;
  await admin({action:"approve",applicationId:application});
  expect((await snapshot("p")).notifications[0].message).toContain("管理员将您加入了");
  expect((await snapshot("c")).notifications).toHaveLength(1);
  await admin({action:"create_team",playerId:member,name:"新球队"});
  expect((await snapshot("p")).notifications[0].message).toContain("并设为队长");
  expect((await snapshot("c")).notifications).toHaveLength(2);
  const permissions=await db.query<{allowed:boolean}>("select has_function_privilege('service_role','registration_notify_admin_roster(jsonb)','execute') as allowed");
  expect(permissions.rows[0].allowed).toBe(false);
});

it("message receipts follow the account across sessions and renames while new statuses stay unread", async () => {
  await register("队长","13800138931","captain","本队");
  const player=await register("球员","13800138932");
  await login("队长","c"); await login("球员","p1"); await login("球员","p2");
  await adminLogin();
  const team=(await teams())[0].id;
  await act("p1","apply",team);
  const application=(await snapshot("p1")).applications[0];
  const mark = (token:string,receipts:unknown[])=>db.query("select registration_read_messages($1,$2::jsonb)",[token,JSON.stringify(receipts)]);
  await mark("p1",[{id:application.id,status:"pending"}]);
  expect((await snapshot("p2")).readMessages[application.id]).toBe("pending");
  await admin({action:"approve",applicationId:application.id});
  expect((await snapshot("p2")).applications[0].status).toBe("approved");
  expect((await snapshot("p2")).readMessages[application.id]).toBe("pending");
  const notification=(await snapshot("p1")).notifications[0];
  await mark("p1",[{id:application.id,status:"approved"},{id:notification.id,status:"received"}]);
  await admin({action:"rename_team",teamId:team,name:"新队名"});
  expect((await snapshot("p2")).readMessages).toMatchObject({[application.id]:"approved",[notification.id]:"received"});
  await mark("c",[{id:notification.id,status:"received"}]);
  expect((await snapshot("c")).readMessages[notification.id]).toBeUndefined();
  await mark("p1",[{id:application.id,status:"pending"}]);
  expect((await snapshot("p2")).readMessages[application.id]).toBe("approved");
  await expect(mark("invalid",[])).rejects.toThrow("UNAUTHORIZED");
  await db.exec(readFileSync(new URL("../supabase/015_message_read_receipts.sql",import.meta.url),"utf8"));
  expect((await snapshot("p2")).readMessages[notification.id]).toBe("received");
});

it("self profile changes preserve identity and memberships and expose the phone only to its owner", async () => {
  const captain=await register("队长","13800138941","captain","本队");
  const member=await register("球员","13800138942");
  await login("队长","c"); await login("球员","p");
  const team=(await teams())[0].id;
  await act("c","recruit",team,member);
  const update=(token:string,profile:unknown)=>db.query("select registration_update_profile($1,$2::jsonb)",[token,JSON.stringify(profile)]);
  const profile={name:"新姓名",gender:"非二元性别",school:"北京大学校友",phone:"13800138943"};
  await expect(update("invalid",profile)).rejects.toThrow("UNAUTHORIZED");
  await expect(update("p",{...profile,phone:"13800138941"})).rejects.toThrow("PHONE_EXISTS");
  await expect(update("p",{...profile,school:""})).rejects.toThrow("INVALID_INPUT");
  await update("p",{...profile,playerId:captain,role:"captain",teamId:null});
  const result=await snapshot("p");
  expect(result.viewer).toMatchObject({...profile,id:member,teamId:team,role:"player"});
  expect(result.notifications).toHaveLength(1);
  expect(result.teams[0].players.find((p:any)=>p.id===member).phone).toBeUndefined();
  expect((await snapshot("c")).viewer.phone).toBe("13800138941");
  await expect(login("球员","old-login","13800138942")).rejects.toThrow("NOT_FOUND");
  await login("新姓名","new-login","13800138943");
  expect((await snapshot("new-login")).viewer.id).toBe(member);
  await update("c",{name:"新队长",gender:"女",school:"北京大学",phone:"13800138944"});
  expect((await snapshot("c")).viewer).toMatchObject({id:captain,teamId:team,role:"captain"});
  expect((await snapshot("p")).teams[0].captainPhone).toBe("13800138944");
});

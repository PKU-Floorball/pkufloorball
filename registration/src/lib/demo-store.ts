import { randomUUID } from "node:crypto";
import type {
  Store,
  Player,
  RegisterInput,
  Action,
  Application,
  Snapshot,
  PlayerNotification,
} from "./types";
import { AppError, parseRegistration } from "./validation";
type PrivatePlayer = Player & { phone: string };
export function createDemoStore(): Store {
  const players: PrivatePlayer[] = [],
    teams: { id: string; name: string; captainId: string }[] = [],
    applications: Application[] = [];
  const readMessages: Record<string, Record<string,string>> = {};
  const notifications: (PlayerNotification & { playerId: string })[] = [];
  const sessions = new Map<string, { id: string; expires: number }>();
  function seed(
    input: Omit<RegisterInput, "school"> & { school?: string;
      role: "captain" | "player";
      teamName: string | null;
      teamId: string | null;
    },
  ) {
    if (players.some((p) => p.phone === input.phone && p.name === input.name.trim()))
      throw new AppError("ALREADY_REGISTERED");
    if (players.some((p) => p.phone === input.phone))
      throw new AppError("PHONE_EXISTS");
    if (
      input.role === "captain" &&
      teams.some((t) => t.name === input.teamName)
    )
      throw new AppError("TEAM_EXISTS");
    if (input.teamId && !teams.some((t) => t.id === input.teamId))
      throw new AppError("TEAM_NOT_FOUND");
    const player: PrivatePlayer = {
      id: randomUUID(),
      name: input.name,
      gender: input.gender,
      school: input.school?.trim() || "北京大学",
      phone: input.phone,
      role: input.role,
      teamId: input.teamId,
    };
    if (input.role === "captain") {
      const team = {
        id: randomUUID(),
        name: input.teamName!,
        captainId: player.id,
      };
      teams.push(team);
      player.teamId = team.id;
    }
    players.push(player);
  }
  seed({
    name: "陈宇",
    gender: "男",
    phone: "13800000001",
    role: "captain",
    teamName: "未名之翼",
    teamId: null,
  });
  seed({
    name: "周悦",
    gender: "女",
    phone: "13800000002",
    role: "captain",
    teamName: "燕园闪电",
    teamId: null,
  });
  seed({
    name: "王子安",
    gender: "男",
    phone: "13800000003",
    role: "player",
    teamName: null,
    teamId: teams[0].id,
  });
  seed({
    name: "苏晴",
    gender: "女",
    phone: "13800000004",
    role: "player",
    teamName: null,
    teamId: teams[0].id,
  });
  seed({
    name: "许星",
    gender: "男",
    phone: "13800000005",
    role: "player",
    teamName: null,
    teamId: teams[1].id,
  });
  for (const [i, name] of ["林夏", "陆一凡", "赵宁", "李可"].entries())
    seed({
      name,
      gender: i % 2 ? "男" : "女",
      phone: `1380000001${i}`,
      role: "player",
      teamName: null,
      teamId: null,
    });
  function actor(hash: string) {
    const session = sessions.get(hash);
    if (!session || session.expires < Date.now())
      throw new AppError("UNAUTHORIZED", 401);
    const p = players.find((p) => p.id === session.id);
    if (!p) throw new AppError("UNAUTHORIZED", 401);
    return p;
  }
  function publicPlayer(p: PrivatePlayer): Player {
    return {
      id: p.id,
      name: p.name,
      gender: p.gender,
      school: p.school,
      role: p.role,
      teamId: p.teamId,
    };
  }
  function act(hash: string, input: Action) {
    const viewer = actor(hash);
    if (input.action === "update_profile") {
      const profile = parseRegistration(input.profile || {});
      if (players.some(p=>p.id!==viewer.id && p.phone===profile.phone)) throw new AppError("PHONE_EXISTS");
      if (players.some(p=>p.id!==viewer.id && p.name===profile.name && p.phone.slice(-4)===profile.phone.slice(-4))) throw new AppError("LOGIN_AMBIGUOUS");
      Object.assign(viewer,profile);
      for (const a of applications) if (a.playerId===viewer.id) Object.assign(a,{name:viewer.name,gender:viewer.gender,school:viewer.school});
      return;
    }
    if (input.action === "read_messages") {
      const read = readMessages[viewer.id] ||= {};
      for (const r of input.receipts || []) {
        if (notifications.some(n=>n.id===r.id && n.playerId===viewer.id && r.status==="received") ||
          applications.some(a=>a.id===r.id && a.status===r.status && (a.playerId===viewer.id || teams.some(t=>t.id===a.teamId && t.captainId===viewer.id))))
          read[r.id]=r.status;
      }
      return;
    }
    if (input.action === "leave_team") {
      if (viewer.role === "captain") throw new AppError("CAPTAIN_CONFLICT");
      if (!input.teamId || !viewer.teamId || input.teamId !== viewer.teamId) throw new AppError("PLAYER_NOT_IN_TEAM");
      viewer.teamId = null;
      for (const a of applications) if (a.playerId === viewer.id && a.status === "pending") a.status = "cancelled";
      return;
    }
    if (input.action === "apply" || input.action === "switch_apply") {
      if (viewer.role !== "player") throw new AppError("CAPTAIN_CONFLICT");
      const reason = input.reason?.trim() || "";
      if (reason.length > 500) throw new AppError("INVALID_INPUT");
      if (input.action === "switch_apply") {
        if (!input.sourceTeamId || !viewer.teamId || input.sourceTeamId !== viewer.teamId) throw new AppError("PLAYER_NOT_IN_TEAM");
        if (input.teamId === input.sourceTeamId) throw new AppError("INVALID_INPUT");
      } else if (viewer.teamId) throw new AppError("ALREADY_JOINED");
      const team = teams.find((t) => t.id === input.teamId);
      if (!team) throw new AppError("TEAM_NOT_FOUND");
      if (
        applications.some(
          (a) =>
            a.playerId === viewer.id &&
            a.teamId === team.id &&
            a.status === "pending",
        )
      )
        throw new AppError("DUPLICATE_APPLICATION");
      if (input.action === "switch_apply") {
        viewer.teamId = null;
        for (const a of applications) if (a.playerId === viewer.id && a.status === "pending") a.status = "cancelled";
      }
      applications.unshift({
        id: randomUUID(),
        playerId: viewer.id,
        teamId: team.id,
        name: viewer.name,
        gender: viewer.gender,
        teamName: team.name,
        reason,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      return;
    }
    if (viewer.role !== "captain") throw new AppError("FORBIDDEN", 403);
    if (input.action === "rename_team") {
      const team = teams.find(t => t.id === input.teamId && t.captainId === viewer.id);
      if (!team || viewer.role !== "captain") throw new AppError("FORBIDDEN", 403);
      const name = input.name?.trim() || "";
      if (!name || name.length > 40) throw new AppError("INVALID_INPUT");
      if (teams.some(t => t.id !== team.id && t.name === name)) throw new AppError("TEAM_EXISTS");
      team.name = name;
      for (const application of applications) if (application.teamId === team.id) application.teamName = name;
      return;
    }
    if (["transfer_captain", "leave_captain", "dissolve_team"].includes(input.action)) {
      const team = teams.find((t) => t.id === input.teamId && t.captainId === viewer.id);
      if (!team) throw new AppError("FORBIDDEN", 403);
      if (input.action === "dissolve_team") {
        for (const p of players) if (p.teamId === team.id) { p.teamId = null; p.role = "player"; }
        for (let i = applications.length - 1; i >= 0; i--) if (applications[i].teamId === team.id) applications.splice(i, 1);
        teams.splice(teams.indexOf(team), 1);
        return;
      }
      const successor = players.find((p) => p.id === input.playerId);
      if (!successor || successor.id === viewer.id || successor.role !== "player" || successor.teamId !== team.id) throw new AppError("INVALID_SUCCESSOR");
      team.captainId = successor.id;
      successor.role = "captain";
      viewer.role = "player";
      if (input.action === "leave_captain") viewer.teamId = null;
      return;
    }
    const directMemberAction =
      input.action === "recruit" || input.action === "remove";
    const app = applications.find((a) => a.id === input.applicationId);
    const teamId = directMemberAction ? input.teamId : app?.teamId;
    const team = teams.find(
      (t) => t.id === teamId && t.captainId === viewer.id,
    );
    if (!team)
      throw new AppError(
        app || directMemberAction ? "FORBIDDEN" : "APPLICATION_CLOSED",
        403,
      );
    const player = players.find(
      (p) => p.id === (directMemberAction ? input.playerId : app?.playerId),
    );
    if (!player) throw new AppError("NOT_FOUND");
    if (input.action === "remove") {
      if (player.role !== "player") throw new AppError("FORBIDDEN", 403);
      if (player.teamId !== team.id) throw new AppError("PLAYER_NOT_IN_TEAM");
      player.teamId = null;
      return;
    }
    if (input.action !== "recruit" && app?.status !== "pending")
      throw new AppError("APPLICATION_CLOSED");
    if (player.teamId) throw new AppError("ALREADY_JOINED");
    if (player.role !== "player") throw new AppError("FORBIDDEN", 403);
    if (input.action === "reject") {
      app!.status = "rejected";
      return;
    }
    player.teamId = team.id;
    if (input.action === "recruit") notifications.unshift({ id: randomUUID(), playerId: player.id, actorName: viewer.name, teamName: team.name, createdAt: new Date().toISOString() });
    for (const a of applications)
      if (a.playerId === player.id && a.status === "pending")
        a.status =
          a.id === app?.id && input.action === "approve"
            ? "approved"
            : "cancelled";
  }
  return {
    publicTeams: async () => teams.map((t) => ({ id: t.id, name: t.name })),
    register: async (i) => {
      if (typeof i.school !== "string" || !i.school.trim() || i.school.trim().length > 80) throw new AppError("INVALID_INPUT");
      seed({ ...i, role: "player", teamName: null, teamId: null });
    },
    createTeam: async (hash, input) => {
      const viewer = actor(hash);
      if (viewer.teamId || viewer.role !== "player")
        throw new AppError("ALREADY_JOINED");
      if (
        !input.name.trim() ||
        input.name.trim().length > 40 ||
        input.memberIds.includes(viewer.id) ||
        new Set(input.memberIds).size !== input.memberIds.length ||
        input.memberIds.length > 80
      )
        throw new AppError("INVALID_INPUT");
      if (teams.some((t) => t.name === input.name.trim()))
        throw new AppError("TEAM_EXISTS");
      const members = input.memberIds.map((id) =>
        players.find((p) => p.id === id),
      );
      if (members.some((p) => !p || p.teamId || p.role !== "player"))
        throw new AppError("PLAYER_UNAVAILABLE");
      const team = {
        id: randomUUID(),
        name: input.name.trim(),
        captainId: viewer.id,
      };
      teams.push(team);
      viewer.role = "captain";
      viewer.teamId = team.id;
      for (const member of members) member!.teamId = team.id;
      for (const a of applications)
        if (
          a.status === "pending" &&
          (a.playerId === viewer.id || input.memberIds.includes(a.playerId))
        )
          a.status = "cancelled";
    },
    login: async (name, phone, hash) => {
      if (!phone || !/^[0-9]{4}$/.test(phone)) throw new AppError("INVALID_PHONE_SUFFIX");
      const matches = players.filter(
        (p) => p.name === name && p.phone.endsWith(phone),
      );
      if (!matches.length) throw new AppError("NOT_FOUND");
      if (matches.length > 1) throw new AppError("LOGIN_AMBIGUOUS");
      sessions.set(hash, {
        id: matches[0].id,
        expires: Date.now() + 604800000,
      });
    },
    snapshot: async (hash): Promise<Snapshot> => {
      const viewer = actor(hash);
      return {
        readMessages: {...readMessages[viewer.id]},
        viewer: {...publicPlayer(viewer),phone:viewer.phone},
        teams: [...teams]
          .sort(
            (a, b) =>
              Number(b.id === viewer.teamId) - Number(a.id === viewer.teamId),
          )
          .map((t) => ({
            ...t,
            captainPhone: players.find((p) => p.id === t.captainId)!.phone,
            players: players
              .filter((p) => p.teamId === t.id)
              .sort(
                (a, b) =>
                  Number(b.role === "captain") - Number(a.role === "captain"),
              )
              .map(publicPlayer),
          })),
        freePlayers: players
          .filter((p) => !p.teamId && p.role === "player")
          .map(publicPlayer),
        notifications: notifications.filter(n => n.playerId === viewer.id).slice(0, 100).map(({playerId: _playerId, ...n}) => n),
        applications: applications
          .filter((a) =>
            viewer.role === "captain"
              ? teams.some(
                  (t) => t.id === a.teamId && t.captainId === viewer.id,
                )
              : a.playerId === viewer.id,
          )
          .map((a) => ({ ...a })),
      };
    },
    act: async (hash, i) => act(hash, i),
    logout: async (hash) => {
      sessions.delete(hash);
    },
  };
}

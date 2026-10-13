import type { RegisterInput, Action, TeamCreation } from "./types";
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function text(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new AppError("INVALID_INPUT");
  return value.trim();
}
function phone(value: unknown) {
  const result = text(value, 11);
  if (!/^1[3-9]\d{9}$/.test(result)) throw new AppError("INVALID_PHONE");
  return result;
}
export function parseRegistration(raw: Record<string, unknown>): RegisterInput {
  const name = text(raw.name, 30),
    number = phone(raw.phone);
  if (raw.gender !== "男" && raw.gender !== "女" && raw.gender !== "非二元性别" && raw.gender !== "不愿意透露")
    throw new AppError("INVALID_INPUT");
  return { name, gender: raw.gender, phone: number, school: text(raw.school, 80) };
}
export function parseTeamCreation(raw: Record<string, unknown>): TeamCreation {
  const name = text(raw.name, 40),
    memberIds = raw.memberIds;
  if (
    !Array.isArray(memberIds) ||
    memberIds.length > 80 ||
    memberIds.some((id) => typeof id !== "string" || !uuid.test(id)) ||
    new Set(memberIds).size !== memberIds.length
  )
    throw new AppError("INVALID_INPUT");
  return { name, memberIds };
}
export function parseLogin(raw: Record<string, unknown>) {
  return {
    name: text(raw.name, 30),
    phone: raw.phone ? phone(raw.phone) : null,
  };
}
export function parseAction(raw: Record<string, unknown>): Action {
  if (
    !["apply", "recruit", "approve", "reject", "remove", "transfer_captain", "leave_captain", "dissolve_team", "leave_team", "switch_apply"].includes(
      String(raw.action),
    )
  )
    throw new AppError("INVALID_INPUT");
  const result: Action = { action: raw.action as Action["action"] };
  for (const key of ["teamId", "playerId", "applicationId", "sourceTeamId"] as const) {
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== "string" || !uuid.test(raw[key]))
        throw new AppError("INVALID_INPUT");
      result[key] = raw[key];
    }
  }
  if (
    (result.action === "apply" ||
      result.action === "recruit" ||
      ["remove", "transfer_captain", "leave_captain", "dissolve_team", "leave_team", "switch_apply"].includes(result.action)) &&
    !result.teamId
  )
    throw new AppError("INVALID_INPUT");
  if (
    ["recruit", "remove", "transfer_captain", "leave_captain"].includes(result.action) &&
    !result.playerId
  )
    throw new AppError("INVALID_INPUT");
  if (
    (result.action === "approve" || result.action === "reject") &&
    !result.applicationId
  )
    throw new AppError("INVALID_INPUT");
  if (result.action === "switch_apply" && !result.sourceTeamId) throw new AppError("INVALID_INPUT");
  if (result.action === "apply" || result.action === "switch_apply") {
    if (raw.reason !== undefined && (typeof raw.reason !== "string" || raw.reason.trim().length > 500)) throw new AppError("INVALID_INPUT");
    result.reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  }
  return result;
}
export const messages: Record<string, string> = {
  INVALID_SUCCESSOR: "请选择本队的一名普通队员接任队长；名单可能已变化，请刷新后重试。",
  ADMIN_PASSWORD: "管理员密码不正确。",
  CAPTAIN_CONFLICT: "该选手仍是队长，请先更换队长或解散球队，再进行调配或删除。",
  INVALID_INPUT: "请检查填写的信息。",
  INVALID_PHONE: "请输入正确的 11 位手机号。",
  NEED_PHONE: "存在同名报名者，请补充手机号。",
  NOT_FOUND: "没有找到对应的报名信息，请检查姓名或先注册。",
  ALREADY_REGISTERED: "您已经注册过了，直接登录即可。",
  PHONE_EXISTS: "这个手机号已被使用，但姓名不一致，请检查姓名或联系管理员。",
  TEAM_EXISTS: "这个队名已被使用，请换一个名称。",
  TEAM_NOT_FOUND: "该球队已不存在，请重新选择。",
  UNAUTHORIZED: "请先登录，或重新登录后再试。",
  FORBIDDEN: "只有该队队长可以进行此操作。",
  PLAYER_UNAVAILABLE: "有球员已加入其他球队，请重新选择自由球员。",
  PLAYER_NOT_IN_TEAM: "该队员已不在本队，请刷新名单。",
  ALREADY_JOINED: "该球员已经加入球队，请刷新名单。",
  DUPLICATE_APPLICATION: "已经申请过这支球队，请等待队长处理。",
  APPLICATION_CLOSED: "这条申请已处理，请刷新消息。",
  UNCONFIGURED: "报名数据库尚未配置，请联系组织者。",
  SERVICE_UNAVAILABLE: "暂时无法连接报名服务，请稍后重试。",
  BAD_ORIGIN: "请求来源无效，请从报名网页操作。",
};

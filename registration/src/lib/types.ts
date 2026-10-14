export type Role = "captain" | "player";
export type Gender = "男" | "女" | "非二元性别" | "不愿意透露";
export type Player = {
  id: string;
  name: string;
  gender: Gender;
  school: string;
  role: Role;
  teamId: string | null;
};
export type Team = {
  id: string;
  name: string;
  captainId: string;
  captainPhone: string;
  players: Player[];
};
export type TeamOption = { id: string; name: string };
export type Application = {
  id: string;
  playerId: string;
  teamId: string;
  name: string;
  gender: Gender;
  teamName: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
};
export type PlayerNotification = { message?: string | null; id: string; actorName: string; teamName: string; createdAt: string };
export type Snapshot = {
  readMessages?: Record<string, string>;
  notifications?: PlayerNotification[];
  viewer: Player & {phone?: string};
  teams: Team[];
  freePlayers: Player[];
  applications: Application[];
};
export type RegisterInput = {
  name: string;
  gender: Gender;
  school: string;
  phone: string;
};
export type TeamCreation = { name: string; memberIds: string[] };
export type Action = {
  action: "update_profile" | "read_messages" | "rename_team" | "apply" | "recruit" | "approve" | "reject" | "remove" | "transfer_captain" | "leave_captain" | "dissolve_team" | "leave_team" | "switch_apply";
  teamId?: string;
  playerId?: string;
  applicationId?: string;
  sourceTeamId?: string;
  name?: string;
  reason?: string;
  profile?: RegisterInput;
  receipts?: {id: string; status: string}[];
};
export type PublicState = {
  mode: "demo" | "cloud" | "unconfigured";
  teams: TeamOption[];
  snapshot: Snapshot | null;
};
export interface Store {
  publicTeams(): Promise<TeamOption[]>;
  register(input: RegisterInput): Promise<void>;
  createTeam(hash: string, input: TeamCreation): Promise<void>;
  login(name: string, phone: string | null, hash: string): Promise<void>;
  snapshot(hash: string): Promise<Snapshot>;
  act(hash: string, input: Action): Promise<void>;
  logout(hash: string): Promise<void>;
}

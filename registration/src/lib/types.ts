export type Role = "captain" | "player";
export type Gender = "男" | "女";
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
export type Snapshot = {
  viewer: Player;
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
  action: "apply" | "recruit" | "approve" | "reject" | "remove" | "transfer_captain" | "leave_captain" | "dissolve_team" | "leave_team" | "switch_apply";
  teamId?: string;
  playerId?: string;
  applicationId?: string;
  sourceTeamId?: string;
  reason?: string;
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

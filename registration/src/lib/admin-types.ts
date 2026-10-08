import type { Player, Application } from "./types";
export type AdminPlayer = Player & { phone: string };
export type AdminTeam = { id: string; name: string; captainId: string };
export type AdminSnapshot = {
  players: AdminPlayer[];
  teams: AdminTeam[];
  applications: Application[];
};

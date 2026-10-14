import { createClient } from "@supabase/supabase-js";
import { AppError, messages } from "./validation";
import type {
  Store,
  RegisterInput,
  Action,
  Snapshot,
  TeamOption,
} from "./types";
export function supabaseStore(): Store {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(12000) }),
      },
    },
  );
  async function rpc<T>(name: string, args: Record<string, unknown> = {}) {
    const { data, error } = await client.rpc(name, args);
    if (error) {
      const code =
        Object.keys(messages).find((code) => error.message.includes(code)) ||
        "SERVICE_UNAVAILABLE";
      throw new AppError(
        code,
        code === "UNAUTHORIZED"
          ? 401
          : code === "FORBIDDEN"
            ? 403
            : code === "SERVICE_UNAVAILABLE"
              ? 503
              : 400,
      );
    }
    return data as T;
  }
  return {
    publicTeams: () => rpc<TeamOption[]>("registration_public_teams"),
    register: async (input: RegisterInput) => {
      await rpc("register_person", {
        p_name: input.name,
        p_gender: input.gender,
        p_phone: input.phone,
        p_school: input.school,
      });
    },
    createTeam: async (hash, input) => {
      await rpc("registration_create_team", {
        p_hash: hash,
        p_name: input.name,
        p_member_ids: input.memberIds,
      });
    },
    login: async (name, phone, hash) => {
      if (!phone || !/^[0-9]{4}$/.test(phone)) throw new AppError("INVALID_PHONE_SUFFIX");
      // Keep the complete number on the server; the browser only submits its suffix.
      const { data, error } = await client.from("players").select("phone")
        .eq("name", name).like("phone", `%${phone}`).limit(2);
      if (error) throw new AppError("SERVICE_UNAVAILABLE", 503);
      if (!data?.length) throw new AppError("NOT_FOUND");
      if (data.length !== 1) throw new AppError("LOGIN_AMBIGUOUS");
      await rpc("login_player", { p_name: name, p_phone: data[0].phone, p_hash: hash });
    },
    snapshot: (hash) =>
      rpc<Snapshot>("registration_snapshot", { p_hash: hash }),
    act: async (hash: string, input: Action) => {
      if (input.action === "update_profile") {
        await rpc("registration_update_profile", {p_hash:hash,p_input:input.profile});
        return;
      }
      if (input.action === "read_messages") {
        await rpc("registration_read_messages", {p_hash:hash,p_receipts:input.receipts});
        return;
      }
      if (input.action === "rename_team") {
        await rpc("registration_rename_team", { p_hash: hash, p_team_id: input.teamId, p_name: input.name });
        return;
      }
      await rpc("registration_action", {
        p_hash: hash,
        p_action: input.action,
        p_team_id: input.teamId ?? null,
        p_player_id: input.playerId ?? null,
        p_application_id: input.applicationId ?? null,
        p_reason: input.reason ?? null,
        p_source_team_id: input.sourceTeamId ?? null,
      });
    },
    logout: async (hash) => {
      await rpc("logout_player", { p_hash: hash });
    },
  };
}

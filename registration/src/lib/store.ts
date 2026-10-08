import type { Store } from "./types";
import { createDemoStore } from "./demo-store";
import { supabaseStore } from "./supabase-store";
import { AppError } from "./validation";
const root = globalThis as typeof globalThis & { registrationDemo?: Store };
export function mode() {
  if (
    process.env.REGISTRATION_DEMO === "true" &&
    process.env.NODE_ENV !== "production"
  )
    return "demo" as const;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    return "cloud" as const;
  return "unconfigured" as const;
}
export function getStore(): Store {
  if (mode() === "demo") return (root.registrationDemo ??= createDemoStore());
  if (mode() === "cloud") return supabaseStore();
  throw new AppError("UNCONFIGURED", 503);
}

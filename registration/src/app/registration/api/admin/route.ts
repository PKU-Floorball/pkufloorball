import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSameOrigin } from "@/lib/origin";
import {
  ADMIN_COOKIE,
  hashToken,
  newSession,
  verifyAdminPassword,
} from "@/lib/session";
import { AppError, messages } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function failure(error: unknown) {
  const e =
    error instanceof AppError
      ? error
      : new AppError("SERVICE_UNAVAILABLE", 503);
  return response(
    { code: e.code, error: messages[e.code] || messages.SERVICE_UNAVAILABLE },
    e.status,
  );
}
function hash(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new AppError("UNAUTHORIZED", 401);
  return hashToken(token);
}
async function rpc(name: string, args: Record<string, unknown>) {
  if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.REGISTRATION_DEMO === "true"
  )
    throw new AppError("UNCONFIGURED", 503);
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(12000) }),
      },
    },
  );
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const code =
      Object.keys(messages).find((k) => error.message.includes(k)) ||
      "SERVICE_UNAVAILABLE";
    throw new AppError(
      code,
      code === "UNAUTHORIZED"
        ? 401
        : code === "SERVICE_UNAVAILABLE"
          ? 503
          : 400,
    );
  }
  return data;
}
export async function GET(request: NextRequest) {
  try {
    return response(
      await rpc("registration_admin_snapshot", { p_hash: hash(request) }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    if (
      !isSameOrigin(request.headers.get("origin"), request.headers.get("host"))
    )
      throw new AppError("BAD_ORIGIN", 403);
    const text = await request.text();
    if (text.length > 4096) throw new AppError("INVALID_INPUT");
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
      if (!body || Array.isArray(body) || typeof body !== "object")
        throw new Error();
    } catch {
      throw new AppError("INVALID_INPUT");
    }
    if (body.action === "login") {
      if (!verifyAdminPassword(body.password))
        throw new AppError("ADMIN_PASSWORD", 401);
      const session = newSession();
      await rpc("registration_admin_login", { p_hash: session.hash });
      const old = request.cookies.get(ADMIN_COOKIE)?.value;
      if (old && /^[a-f0-9]{64}$/.test(old))
        await rpc("registration_admin_logout", { p_hash: hashToken(old) });
      const result = response({ ok: true });
      result.cookies.set(ADMIN_COOKIE, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 28800,
      });
      return result;
    }
    const tokenHash = hash(request);
    if (body.action === "logout") {
      await rpc("registration_admin_logout", { p_hash: tokenHash });
      const result = response({ ok: true });
      result.cookies.set(ADMIN_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return result;
    }
    if (body.teamId === "") body.teamId = null;
    if (body.action === "create_captain") throw new AppError("INVALID_INPUT");
    await rpc(
      body.action === "create_player"
        ? "registration_admin_register_person"
        : "registration_admin_action",
      {
        p_hash: tokenHash,
        p_input: body,
      },
    );
    return response({ ok: true });
  } catch (e) {
    return failure(e);
  }
}

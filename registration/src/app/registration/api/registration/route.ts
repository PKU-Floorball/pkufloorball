import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/origin";
import { getStore, mode } from "@/lib/store";
import { hashToken, newSession, SESSION_COOKIE } from "@/lib/session";
import {
  AppError,
  messages,
  parseAction,
  parseLogin,
  parseRegistration,
  parseTeamCreation,
} from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function failure(error: unknown) {
  const known =
    error instanceof AppError
      ? error
      : new AppError("SERVICE_UNAVAILABLE", 503);
  return response(
    {
      error: messages[known.code] ?? messages.SERVICE_UNAVAILABLE,
      code: known.code,
    },
    known.status,
  );
}
function sessionHash(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new AppError("UNAUTHORIZED", 401);
  return hashToken(token);
}
function clearCookie(result: NextResponse) {
  result.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return result;
}
export async function GET(request: NextRequest) {
  try {
    if (mode() === "unconfigured")
      return response({ mode: "unconfigured", teams: [], snapshot: null });
    const store = getStore();
    let snapshot = null;
    if (request.cookies.get(SESSION_COOKIE)?.value) {
      try {
        snapshot = await store.snapshot(sessionHash(request));
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "UNAUTHORIZED")
          throw error;
      }
    }
    const result = response({
      mode: mode(),
      teams: await store.publicTeams(),
      snapshot,
    });
    return snapshot ? result : clearCookie(result);
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    if (
      !isSameOrigin(request.headers.get("origin"), request.headers.get("host"))
    )
      throw new AppError("BAD_ORIGIN", 403);
    if (Number(request.headers.get("content-length") ?? 0) > 4096)
      throw new AppError("INVALID_INPUT");
    let body: Record<string, unknown>;
    try {
      body = await request.json();
      if (!body || Array.isArray(body) || typeof body !== "object")
        throw new Error();
    } catch {
      throw new AppError("INVALID_INPUT");
    }
    const store = getStore();
    if (body.action === "register") {
      await store.register(parseRegistration(body));
      return response({ ok: true });
    }
    if (body.action === "create_team") {
      await store.createTeam(sessionHash(request), parseTeamCreation(body));
      return response({ ok: true });
    }
    if (body.action === "login") {
      const input = parseLogin(body),
        session = newSession();
      await store.login(input.name, input.phone, session.hash);
      // Revoke any previous identity in this browser after the new login succeeds.
      if (request.cookies.get(SESSION_COOKIE)?.value)
        await store.logout(sessionHash(request));
      const result = response({ ok: true });
      result.cookies.set(SESSION_COOKIE, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 604800,
      });
      return result;
    }
    if (body.action === "logout") {
      if (request.cookies.get(SESSION_COOKIE)?.value)
        await store.logout(sessionHash(request));
      return clearCookie(response({ ok: true }));
    }
    await store.act(sessionHash(request), parseAction(body));
    return response({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

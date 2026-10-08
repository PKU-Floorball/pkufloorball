import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const SESSION_COOKIE = "floorball_session";
export function newSession() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const ADMIN_COOKIE = "floorball_admin_session";
export function verifyAdminPassword(value: unknown): boolean {
  const configured = process.env.REGISTRATION_ADMIN_PASSWORD;
  if (!configured || typeof value !== "string" || value.length > 256)
    return false;
  const expected = createHash("sha256").update(configured).digest();
  const actual = createHash("sha256").update(value).digest();
  return timingSafeEqual(expected, actual);
}

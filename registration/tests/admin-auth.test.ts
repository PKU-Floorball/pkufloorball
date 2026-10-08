import { afterEach, expect, it, vi } from "vitest";
import * as session from "../src/lib/session";
afterEach(() => vi.unstubAllEnvs());
it("accepts only the configured admin password and fails closed without configuration", () => {
  const verify = (session as any).verifyAdminPassword;
  expect(verify).toBeTypeOf("function");
  vi.stubEnv("REGISTRATION_ADMIN_PASSWORD", "test-secret");
  expect(verify("test-secret")).toBe(true);
  for (const value of ["wrong", "", null, {}, "管理员"])
    expect(verify(value)).toBe(false);
  vi.stubEnv("REGISTRATION_ADMIN_PASSWORD", "");
  expect(verify("")).toBe(false);
});

import { expect, it } from "vitest";
import { isSameOrigin } from "../src/lib/origin";
it("accepts the browser host even when Next internally uses a different canonical URL", () => {
  expect(isSameOrigin("http://127.0.0.1:3100", "127.0.0.1:3100")).toBe(true);
  expect(
    isSameOrigin("https://registration.vercel.app", "registration.vercel.app"),
  ).toBe(true);
});
it("rejects external, malformed and missing origins", () => {
  expect(isSameOrigin("https://evil.example", "registration.vercel.app")).toBe(
    false,
  );
  expect(isSameOrigin("http://127.0.0.1:3101", "127.0.0.1:3100")).toBe(false);
  expect(isSameOrigin(null, "registration.vercel.app")).toBe(false);
  expect(isSameOrigin("bad-origin", "registration.vercel.app")).toBe(false);
});

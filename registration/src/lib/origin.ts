export function isSameOrigin(
  origin: string | null,
  host: string | null,
): boolean {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.origin === origin &&
      url.host === host
    );
  } catch {
    return false;
  }
}

import { createHash, timingSafeEqual } from "node:crypto";

// Hashing first gives both buffers the same length, so the comparison time never leaks the secret's size.
export function safeEqual(
  received: string | null | undefined,
  expected: string,
): boolean {
  if (!received || !expected) return false;
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Internal path to go to after login; anything that could leave the app ("//x", "/\x", "https:") becomes "/". */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (/^\/[\\/]/.test(value) || /[\u0000-\u001f\\]/.test(value)) return "/";
  return value;
}
/** Only exact owned origins may receive an authentication callback. */
export function loginOrigin(
  origin: string | null,
  configuredOrigin: string,
  development = false,
) {
  const canonical = new URL(configuredOrigin).origin;
  const allowed = new Set([
    canonical,
    "https://central3c-caua.vercel.app",
    "https://central3c-caua.netlify.app",
    "https://codex-evolution-preview--central3c-caua.netlify.app",
  ]);
  if (development) {
    allowed.add("http://localhost:3000");
    allowed.add("http://localhost:3001");
    allowed.add("http://localhost:3002");
  }
  return origin && allowed.has(origin) ? origin : canonical;
}

/** A platform adapter may put an immutable deploy URL in request.nextUrl.origin. */
export function callbackOrigin(
  requestHeaders: Headers,
  originCookie: string | undefined,
  configuredOrigin: string,
  development = false,
) {
  const candidates = [originCookie];
  for (const header of ["x-forwarded-host", "host"]) {
    const host = requestHeaders.get(header)?.split(",")[0].trim();
    if (host)
      candidates.push(
        `${development && /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https"}://${host}`,
      );
  }
  for (const candidate of candidates)
    if (
      candidate &&
      loginOrigin(candidate, configuredOrigin, development) === candidate
    )
      return candidate;
  return new URL(configuredOrigin).origin;
}

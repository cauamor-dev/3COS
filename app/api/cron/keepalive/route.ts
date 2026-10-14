import { adminCentral } from "@/lib/central/server";
import { serverEnv } from "@/lib/env";
import { bearerToken, safeEqual } from "@/lib/http/auth";

export async function GET(request: Request) {
  if (!safeEqual(bearerToken(request), serverEnv.cronSecret)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const started = Date.now();
  await adminCentral().ping();
  return Response.json({ ok: true, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
}

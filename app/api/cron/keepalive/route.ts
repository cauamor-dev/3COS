import { adminCentral } from "@/lib/central/server";
import { isCronRequest } from "@/lib/http/cron";

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const started = Date.now();
  await adminCentral().ping();
  return Response.json({ ok: true, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
}

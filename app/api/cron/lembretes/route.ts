import { isCronRequest } from "@/lib/http/cron";
import { notificationTick } from "@/lib/notify/engine";

async function handler(request: Request) {
  if (!isCronRequest(request))
    return Response.json({ ok: false }, { status: 401 });
  const result = await notificationTick();
  return Response.json(
    { ok: true, ...result },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export { handler as GET, handler as POST };

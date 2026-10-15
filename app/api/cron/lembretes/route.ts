import { adminCentral } from "@/lib/central/server";
import { isCronRequest } from "@/lib/http/cron";
import { notify } from "@/lib/notify/notifier";

async function handler(request: Request) {
  if (!isCronRequest(request)) return Response.json({ ok: false }, { status: 401 });
  const sent = await adminCentral().dispatchReminders((notice) => notify(notice));
  return Response.json({ ok: true, sent }, { headers: { "Cache-Control": "no-store" } });
}

export { handler as GET, handler as POST };

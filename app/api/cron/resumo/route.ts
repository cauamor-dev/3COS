import { isCronRequest } from "@/lib/http/cron";
import { notificationTick } from "@/lib/notify/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { checked } from "@/lib/team/service";

async function handler(request: Request) {
  if (!isCronRequest(request))
    return Response.json({ ok: false }, { status: 401 });
  checked(await createAdminClient().rpc("queue_daily_notice"));
  return Response.json(
    { ok: true, ...(await notificationTick()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export { handler as GET, handler as POST };

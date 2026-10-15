import { isCronRequest } from "@/lib/http/cron";
import { collectNews } from "@/lib/news/collector";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

async function handler(request: Request) {
  if (!isCronRequest(request)) return Response.json({ ok: false }, { status: 401 });
  const result = await collectNews(createAdminClient());
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}

export { handler as GET, handler as POST };

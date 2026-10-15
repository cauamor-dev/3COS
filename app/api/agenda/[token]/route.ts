import { adminCentral } from "@/lib/central/server";
import { buildCalendar } from "@/lib/central/ics";
import { addDays, startOfLocalDay } from "@/lib/central/time";
import { serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/http/auth";
import { derivedSecret } from "@/lib/http/derived-secret";

export async function GET(_request: Request, { params }: RouteContext<"/api/agenda/[token]">) {
  const { token } = await params;
  if (!safeEqual(token.replace(/\.ics$/, ""), derivedSecret(serverEnv.mcpSecret, "ics"))) {
    return new Response("Not found", { status: 404 });
  }

  const central = adminCentral();
  const from = addDays(startOfLocalDay(), -30);
  const [events, tasks] = await Promise.all([central.rawEventsBetween(from, addDays(from, 400)), central.tasksForPanel()]);

  return new Response(buildCalendar([...events, ...tasks], serverEnv.appUrl), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="central-3c.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
}

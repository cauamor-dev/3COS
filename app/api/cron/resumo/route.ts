import { adminCentral } from "@/lib/central/server";
import { isCronRequest } from "@/lib/http/cron";
import { notify } from "@/lib/notify/notifier";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handler(request: Request) {
  if (!isCronRequest(request)) return Response.json({ ok: false }, { status: 401 });
  const summary = await adminCentral().dailySummary();
  const html = `<div style="font-family:system-ui,sans-serif;background:#07060b;color:#ededf2;padding:24px">
    <h2 style="margin:0 0 12px">${escapeHtml(summary.title)}</h2>
    ${summary.lines.length ? `<ul style="padding-left:18px;line-height:1.7">${summary.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : `<p>${escapeHtml(summary.body)}</p>`}
  </div>`;
  const results = await notify({ ...summary, html });
  return Response.json({ ok: true, results }, { headers: { "Cache-Control": "no-store" } });
}

export { handler as GET, handler as POST };

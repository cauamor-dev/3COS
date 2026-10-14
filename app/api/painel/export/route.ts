import { getMember } from "@/lib/auth";
import { exportMarkdownZip } from "@/lib/central/export";

export async function GET(request: Request) {
  const member = await getMember();
  if (!member) return new Response("Não autorizado", { status: 401 });

  const data = await member.central.exportAll();
  const stamp = data.exported_at.slice(0, 10);
  const format = new URL(request.url).searchParams.get("formato");

  if (format === "md") {
    const zip = await exportMarkdownZip(data);
    return new Response(zip as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="central-3c-${stamp}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="central-3c-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

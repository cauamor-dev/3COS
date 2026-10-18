import { resolveClient } from "@/lib/integrations/auth";
import { teamOperations } from "@/lib/team/operations";
import { teamFor } from "@/lib/team/server";
import { describeError } from "@/lib/central/format-error";
import { checkClientQuota } from "@/lib/integrations/quota";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ operation: string }> },
) {
  const actor = await resolveClient(request);
  if (!actor || actor.kind !== "integration")
    return Response.json(
      { error: "Use um cliente individual com concessões." },
      { status: 401 },
    );
  try {
    if (!(await checkClientQuota(actor.id)))
      return Response.json(
        { error: "Limite diário local atingido." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    const { operation } = await params;
    const op = teamOperations.find((o) => o.tool === operation);
    if (!op)
      return Response.json({ error: "Operação desconhecida" }, { status: 404 });
    const body = await request.text();
    if (body.length > 60000)
      return Response.json({ error: "Corpo muito grande" }, { status: 413 });
    const result = await op.run(
      teamFor(actor),
      op.schema.parse(JSON.parse(body || "{}")),
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const e = describeError(error);
    return Response.json(
      { error: e.message, code: e.code, request_id: crypto.randomUUID() },
      { status: e.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

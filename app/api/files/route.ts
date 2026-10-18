import { resolveClient } from "@/lib/integrations/auth";
import { checkClientQuota } from "@/lib/integrations/quota";
import { ArtifactService, artifactInput } from "@/lib/files/artifacts";
import { describeError } from "@/lib/central/format-error";
import { z } from "zod";
export async function POST(request: Request) {
  const actor = await resolveClient(request);
  if (!actor || actor.kind !== "integration")
    return Response.json(
      { error: "Cliente individual necessário." },
      { status: 401 },
    );
  if (!(await checkClientQuota(actor.id)))
    return Response.json(
      { error: "Limite da conexão atingido." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  try {
    const body = await request.text();
    if (body.length > 4000)
      return Response.json(
        { error: "Metadados acima do limite." },
        { status: 413 },
      );
    const input = z
      .discriminatedUnion("action", [
        artifactInput.extend({ action: z.literal("reserve") }),
        z.object({ action: z.literal("finalize"), id: z.uuid() }),
      ])
      .parse(JSON.parse(body));
    const files = new ArtifactService(actor);
    const data =
      input.action === "reserve"
        ? await files.reserve(input)
        : await files.finalize(input.id);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const e = describeError(error);
    return Response.json(
      { error: e.message, code: e.code, request_id: crypto.randomUUID() },
      { status: e.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

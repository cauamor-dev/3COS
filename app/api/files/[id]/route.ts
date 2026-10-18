import { getMember } from "@/lib/auth";
import { describeError } from "@/lib/central/format-error";
import { ArtifactService } from "@/lib/files/artifacts";
import { resolveClient } from "@/lib/integrations/auth";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor =
      (await resolveClient(request)) ?? (await getMember())?.central.actor;
    if (!actor)
      return new Response("Entre novamente para abrir o arquivo.", {
        status: 401,
      });
    const url = await new ArtifactService(actor).download((await params).id);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    const e = describeError(error);
    return Response.json({ error: e.message }, { status: e.status });
  }
}

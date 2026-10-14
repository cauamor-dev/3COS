import { buildOpenApi } from "@/lib/api/openapi";
import { serverEnv } from "@/lib/env";

export function GET() {
  return Response.json(buildOpenApi(serverEnv.appUrl), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}

import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken, safeEqual } from "@/lib/http/auth";
import { serverEnv } from "@/lib/env";
import type { AccessOperation, ActorContext } from "@/lib/central/access";
import type { Source } from "@/lib/central/schemas";

export async function resolveClient(
  request: Request,
): Promise<ActorContext | null> {
  const token = bearerToken(request);
  if (!token) return null;
  // Transitional credential has a fixed identity. Headers never establish authorship.
  if (safeEqual(token, serverEnv.apiKey))
    return { kind: "system", id: "legacy-rest", source: "chatgpt" };
  if (!/^c3c_[a-f0-9]{64}$/.test(token)) return null;
  const db = createAdminClient();
  const { data, error } = await db
    .from("integration_clients")
    .select(
      "id,owner_id,agent_id,source,expires_at,revoked_at,agents!inner(handle,retired_at)",
    )
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .maybeSingle();
  if (
    error ||
    !data ||
    data.revoked_at ||
    Date.parse(data.expires_at) <= Date.now()
  )
    return null;
  const agent = Array.isArray(data.agents) ? data.agents[0] : data.agents;
  if (
    !agent ||
    agent.retired_at ||
    (data.source === "grok" && agent.handle !== "clara")
  )
    return null;
  const grants = await db
    .from("client_area_grants")
    .select("area_id,operations,restricted")
    .eq("client_id", data.id);
  if (grants.error) return null;
  return {
    kind: "integration",
    id: data.id,
    userId: data.owner_id,
    agentId: data.agent_id,
    source: data.source as Source,
    grants: (grants.data ?? []).map((g) => ({
      areaId: g.area_id,
      operations: g.operations as AccessOperation[],
      restricted: g.restricted,
    })),
  };
}

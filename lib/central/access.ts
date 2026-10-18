import { CentralError } from "./errors";
import type { Source } from "./schemas";

export const SENSITIVE_ENTRY_IDS = [
  "86a4b8dc-bb95-477f-9664-8badbcaea50a",
] as const;
export type AccessOperation = "read" | "write" | "files" | "team" | "execute";
export interface ActorContext {
  kind: "human" | "integration" | "system";
  id: string;
  source: Source;
  userId?: string;
  agentId?: string;
  grants?: {
    areaId: string;
    operations: AccessOperation[];
    restricted?: boolean;
  }[];
}
export const HUMAN_ACTOR: ActorContext = {
  kind: "human",
  id: "member",
  source: "manual",
};
export const SYSTEM_ACTOR: ActorContext = {
  kind: "system",
  id: "central",
  source: "system",
};
export const CHLOE_ACTOR: ActorContext = {
  kind: "system",
  id: "chloe",
  source: "chloe",
};
export function canArea(
  actor: ActorContext,
  areaId: string,
  operation: AccessOperation = "read",
) {
  return (
    actor.kind !== "integration" ||
    !!actor.grants?.some(
      (g) => g.areaId === areaId && g.operations.includes(operation),
    )
  );
}
export function assertArea(
  actor: ActorContext,
  areaId: string,
  operation: AccessOperation = "read",
) {
  if (!canArea(actor, areaId, operation))
    throw new CentralError(
      "forbidden",
      "Esta conexão não tem permissão para esta área ou operação.",
    );
}
export function canEntry(
  actor: ActorContext,
  entry: {
    id: string;
    area_id: string;
    ai_access?: string;
    owner_id?: string | null;
  },
) {
  if (!canArea(actor, entry.area_id)) return false;
  if (actor.kind === "human")
    return !entry.owner_id || !actor.userId || entry.owner_id === actor.userId;
  if (
    (SENSITIVE_ENTRY_IDS as readonly string[]).includes(entry.id) ||
    entry.ai_access === "private"
  )
    return false;
  if (entry.ai_access === "restricted")
    return !!actor.grants?.some(
      (g) =>
        g.areaId === entry.area_id &&
        g.restricted &&
        g.operations.includes("read"),
    );
  return true;
}
export function actorSource(actor: ActorContext, requested: Source) {
  return actor.kind === "human" ? requested : actor.source;
}

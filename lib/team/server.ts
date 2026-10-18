import "server-only";
import type { ActorContext } from "@/lib/central/access";
import { adminCentral } from "@/lib/central/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamService } from "./service";
export const teamFor = (actor: ActorContext) =>
  new TeamService(createAdminClient(), actor, adminCentral(actor));

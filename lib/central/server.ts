import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistRemoteImage,linkEntryFiles } from "@/lib/files/server";
import { SupabaseNewsStore } from "@/lib/news/store";
import { CentralService } from "./service";
import { SupabaseRepository } from "./supabase-repository";
import { SYSTEM_ACTOR, type ActorContext } from "./access";

export function adminCentral(actor: ActorContext = SYSTEM_ACTOR) {
  const db = createAdminClient();
  return new CentralService(new SupabaseRepository(db), new SupabaseNewsStore(db), { persistImage: persistRemoteImage,linkToEntry:linkEntryFiles }, actor);
}

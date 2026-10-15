import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistRemoteImage } from "@/lib/files/server";
import { SupabaseNewsStore } from "@/lib/news/store";
import { CentralService } from "./service";
import { SupabaseRepository } from "./supabase-repository";

export function adminCentral() {
  const db = createAdminClient();
  return new CentralService(new SupabaseRepository(db), new SupabaseNewsStore(db), { persistImage: persistRemoteImage });
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CentralService } from "./service";
import { SupabaseRepository } from "./supabase-repository";

export function adminCentral() {
  return new CentralService(new SupabaseRepository(createAdminClient()));
}

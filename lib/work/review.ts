import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SENSITIVE_ENTRY_IDS } from "@/lib/central/access";

/** Chloe has no grants for restricted records, even through the admin client. */
export function sharedReviewWorks(db: SupabaseClient) {
  let query = db
    .from("work_items")
    .select("objective,current_step,entry:entries!inner(id,ai_access,archived)")
    .eq("entry.ai_access", "shared")
    .eq("entry.archived", false);
  for (const id of SENSITIVE_ENTRY_IDS) query = query.neq("entry.id", id);
  return query;
}

import "server-only";
import { redirect } from "next/navigation";
import { demoCentral, isDemo } from "@/lib/central/demo";
import { CentralService } from "@/lib/central/service";
import { SupabaseRepository } from "@/lib/central/supabase-repository";
import { serverEnv } from "@/lib/env";
import { MemoryNewsStore, SupabaseNewsStore } from "@/lib/news/store";
import { createUserClient } from "@/lib/supabase/server";

const globalForNews = globalThis as unknown as { demoNews?: MemoryNewsStore };
function demoNews() {
  globalForNews.demoNews ??= new MemoryNewsStore();
  return globalForNews.demoNews;
}

export function isAllowedEmail(email: string | null | undefined) {
  return !!email && email.trim().toLowerCase() === serverEnv.allowedEmail;
}

export async function getMember({ inPrivateCache = false } = {}) {
  if (isDemo()) {
    const supabase = await createUserClient({ inPrivateCache });
    return { email: serverEnv.allowedEmail, supabase, central: await demoCentral(), news: demoNews() };
  }
  const supabase = await createUserClient({ inPrivateCache });
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;
  if (!isAllowedEmail(email)) return null;
  const news = new SupabaseNewsStore(supabase);
  return { email: email!, supabase, central: new CentralService(new SupabaseRepository(supabase), news), news };
}

/**
 * Page data loaders wrap their reads in "use cache: private" with this lifetime. Five minutes is
 * the minimum for Next to put the data in the prefetched App Shell, so switching tabs is instant.
 * Any mutation (refresh()) or realtime change (router.refresh()) clears that client cache.
 */
export const PAGE_DATA_LIFE = { stale: 300, revalidate: 900, expire: 3600 };

/** For use inside a "use cache: private" loader; null means the page should send you to /login. */
export function getCachedMember() {
  return getMember({ inPrivateCache: true });
}

export async function requireMember() {
  const member = await getMember();
  if (!member) redirect("/login");
  return member;
}

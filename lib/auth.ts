import "server-only";
import { redirect } from "next/navigation";
import { demoCentral, isDemo } from "@/lib/central/demo";
import { CentralService } from "@/lib/central/service";
import { SupabaseRepository } from "@/lib/central/supabase-repository";
import { serverEnv } from "@/lib/env";
import { createUserClient } from "@/lib/supabase/server";

export function isAllowedEmail(email: string | null | undefined) {
  return !!email && email.trim().toLowerCase() === serverEnv.allowedEmail;
}

export async function getMember() {
  if (isDemo()) {
    const supabase = await createUserClient();
    return { email: serverEnv.allowedEmail, supabase, central: await demoCentral() };
  }
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;
  if (!isAllowedEmail(email)) return null;
  return { email: email!, supabase, central: new CentralService(new SupabaseRepository(supabase)) };
}

export async function requireMember() {
  const member = await getMember();
  if (!member) redirect("/login");
  return member;
}

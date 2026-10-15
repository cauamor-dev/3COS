import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { serverEnv } from "@/lib/env";

/**
 * `inPrivateCache`: called inside a "use cache: private" loader, where reading the clock is
 * allowed and connection() is not. Everywhere else the auth client's clock read needs connection().
 */
export async function createUserClient({ inPrivateCache = false } = {}) {
  if (!inPrivateCache) await connection();
  const cookieStore = await cookies();
  return createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't write cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

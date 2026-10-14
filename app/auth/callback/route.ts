import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next") ?? "/";
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const supabase = await createUserClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (error) return NextResponse.redirect(`${origin}/login?erro=link`);
  return NextResponse.redirect(`${origin}${destination}`);
}

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { safeRedirectPath } from "@/lib/http/auth";
import { createUserClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const destination = safeRedirectPath(
    searchParams.get("next") ?? (await cookies()).get("3c_login_next")?.value,
  );

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
  const response = NextResponse.redirect(`${origin}${destination}`);
  response.cookies.set("3c_login_next", "", {
    path: "/auth/callback",
    maxAge: 0,
  });
  return response;
}

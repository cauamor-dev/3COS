import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { callbackOrigin } from "@/lib/http/auth";

const PUBLIC_PATHS = ["/login", "/auth", "/privacidade"];

export async function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.CENTRAL_DEMO === "1"
  )
    return NextResponse.next();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet)
            response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {}))
            response.headers.set(key, value);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const email =
    typeof data?.claims.email === "string"
      ? data.claims.email.toLowerCase()
      : null;
  const allowed =
    !!email && email === process.env.ALLOWED_EMAIL?.trim().toLowerCase();

  const { pathname, search } = request.nextUrl;
  const publicOrigin = callbackOrigin(
    request.headers,
    undefined,
    process.env.NEXT_PUBLIC_APP_URL ?? "https://central3c-caua.netlify.app",
    process.env.NODE_ENV === "development",
  );
  const isPublic =
    pathname === "/demos/agendamento.html" ||
    PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

  if (!allowed && !isPublic) {
    const url = new URL(pathname + search, publicOrigin);
    url.pathname = "/login";
    url.search =
      pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (allowed && pathname === "/login") {
    return NextResponse.redirect(new URL("/", publicOrigin));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

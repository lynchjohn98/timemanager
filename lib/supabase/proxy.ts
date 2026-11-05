import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseEnv().url,
    supabaseEnv().key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const loggedIn = !!data?.claims;
  const path = request.nextUrl.pathname;

  // Redirect while keeping the refreshed login cookies
  function redirectTo(pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  const privatePaths = ["/account", "/projects", "/phases"];
  if (!loggedIn && privatePaths.some((p) => path.startsWith(p))) return redirectTo("/login");
  if (loggedIn && (path === "/login" || path === "/signup")) return redirectTo("/account");

  return supabaseResponse;
}

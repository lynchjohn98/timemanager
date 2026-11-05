import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseEnv().url,
    supabaseEnv().key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; proxy.ts handles refreshing instead.
          }
        },
      },
    }
  );
}

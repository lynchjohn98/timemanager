import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  avatar_url: string | null;
  timezone: string;
  app_role: "admin" | "member";
};

// Gets the logged-in user's row from the profiles table (or null if logged out).
// cache() makes sure it only runs once per page load, even if used in several places.
export const getProfile = cache(async (): Promise<Profile | null> => {
  await connection();
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, name, email, created_at, avatar_url, timezone, app_role")
    .eq("id", claims.sub)
    .single();

  if (error || !profile) {
    console.error("Profile lookup failed:", error?.message);
    // Fall back to the login info so the user still shows as logged in
    return {
      id: claims.sub,
      name: (claims.user_metadata as { name?: string } | undefined)?.name ?? null,
      email: (claims.email as string) ?? null,
      created_at: new Date().toISOString(),
      avatar_url: null,
      timezone: "UTC",
      app_role: "member",
    };
  }

  return profile as Profile;
});

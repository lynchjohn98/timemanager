// Supabase connection settings.
//
// The URL and publishable (anon) key are PUBLIC by design: every visitor's browser
// receives them, and your data is protected by the database's security rules.
// So it's safe to write them here as a fallback when the host's environment
// variables are missing. NEVER put the service-role / secret key in this file.
//
// Environment variables still win when they're set (.env.local, Netlify, Vercel…).

// 1. Paste your values from Supabase → Connect → Next.js (or Project Settings → API Keys)
const FALLBACK_URL = "https://qfppazcdplfnlecyvcel.supabase.co";
const FALLBACK_KEY = "sb_publishable_ar7stfsGBxK5CDRIzehrNQ_5rsWq0rm";

// 2. Nothing below needs changing
const isPlaceholder = (v: string) => v.includes("YOUR-PROJECT-ID") || v.includes("PASTE-YOUR");

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || (isPlaceholder(FALLBACK_URL) ? undefined : FALLBACK_URL);

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (isPlaceholder(FALLBACK_KEY) ? undefined : FALLBACK_KEY);

export function supabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      `Supabase isn't configured. Missing: ${[
        !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
        !SUPABASE_KEY && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
      ]
        .filter(Boolean)
        .join(" and ")}. Set it in your host's environment variables and redeploy, or paste it into lib/supabase/env.ts.`
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

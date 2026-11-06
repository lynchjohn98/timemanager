"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; message?: string | null };

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  const supabase = await createClient();

  // Check the code first, so a typo doesn't create an account with no access
  if (code) {
    const { data: check, error: checkError } = await supabase.rpc("check_signup_code", { p_code: code });
    if (checkError) return { error: checkError.message };
    if (!check) return { error: "That code isn't valid, has already been used, or has expired. Check it with whoever invited you." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // The database applies the code when the account is created (admin access or project invite)
    options: { data: { name, invite_code: code || undefined } },
  });

  if (error) return { error: error.message };

  // Confirm email ON → no session yet, user must click the email link
  if (!data.session) {
    return { error: null, message: `Check ${email} for a link to confirm your account.` };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first. Check your inbox." };
    }
    return { error: "Wrong email or password." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** Already have an account: enter an invite (or admin) code to get access. */
export async function redeemCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter the code you were given." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {
    error: null,
    message: data === "admin" ? "You now have admin access." : "You've joined the project. It's on your Projects page.",
  };
}

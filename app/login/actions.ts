"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { safeRedirectPath } from "@/lib/http/auth";
import { createUserClient } from "@/lib/supabase/server";

export interface LoginState {
  step: "email" | "code";
  email: string;
  error?: string;
}

const emailSchema = z.email();

const safeNext = (value: FormDataEntryValue | null) => safeRedirectPath(value);

export async function sendLoginEmail(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { step: "email", email: "", error: "Digite um e-mail válido." };

  const email = parsed.data;
  if (!isAllowedEmail(email)) {
    return { step: "email", email, error: "Este e-mail não tem acesso a esta Central." };
  }

  const supabase = await createUserClient();
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${serverEnv.appUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error) {
    const message =
      error.status === 429
        ? "Muitas tentativas. Espere um minuto e tente de novo."
        : /signups? not allowed|not found/i.test(error.message)
          ? "Este e-mail não tem acesso a esta Central."
          : error.message;
    return { step: "email", email, error: message };
  }
  return { step: "code", email };
}

export async function verifyLoginCode(state: LoginState, formData: FormData): Promise<LoginState> {
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { ...state, error: "Digite o código de 6 dígitos do e-mail." };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.verifyOtp({ email: state.email, token, type: "email" });
  if (error) return { ...state, error: "Código inválido ou expirado. Peça um novo." };

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}

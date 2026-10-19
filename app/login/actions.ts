"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { safeRedirectPath, loginOrigin } from "@/lib/http/auth";
import { loginEmailError } from "@/lib/http/auth-errors";
import { createUserClient } from "@/lib/supabase/server";

export interface LoginState {
  step: "email" | "code";
  email: string;
  error?: string;
}

const emailSchema = z.email();

const safeNext = (value: FormDataEntryValue | null) => safeRedirectPath(value);

export async function sendLoginEmail(
  _: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success)
    return { step: "email", email: "", error: "Digite um e-mail válido." };

  const email = parsed.data;
  if (!isAllowedEmail(email)) {
    return {
      step: "email",
      email,
      error: "Este e-mail não tem acesso a esta Central.",
    };
  }

  const supabase = await createUserClient();
  const next = safeNext(formData.get("next"));
  const origin = loginOrigin(
    (await headers()).get("origin"),
    serverEnv.appUrl,
    process.env.NODE_ENV === "development",
  );
  (await cookies()).set("3c_login_next", next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/callback",
    maxAge: 600,
  });
  (await cookies()).set("3c_login_origin", origin, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/callback",
    maxAge: 600,
  });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { step: "email", email, error: loginEmailError(error) };
  }
  return { step: "code", email };
}

export async function verifyLoginCode(
  state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6)
    return { ...state, error: "Digite o código de 6 dígitos do e-mail." };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.verifyOtp({
    email: state.email,
    token,
    type: "email",
  });
  if (error)
    return { ...state, error: "Código inválido ou expirado. Peça um novo." };

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}

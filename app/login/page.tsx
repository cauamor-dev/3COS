import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Background } from "@/components/shell/background";
import { createUserClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;

  return <LoginForm next={next} linkError={params.erro === "link"} blockedEmail={email} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Background />
      <div className="w-full max-w-sm">
        <Logo className="mb-8 justify-center" />
        <div className="glass border-beam rounded-2xl p-6">
          <h1 className="text-lg font-semibold">Entrar no painel</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            O cérebro compartilhado entre Claude e ChatGPT.
          </p>
          <Suspense fallback={<div className="h-[132px]" />}>
            <LoginContent searchParams={props.searchParams} />
          </Suspense>
        </div>
        <p className="label-mono mt-6 text-center">acesso restrito · magic link</p>
      </div>
    </main>
  );
}

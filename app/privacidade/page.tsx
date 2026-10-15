import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Logo className="mb-10" />
      <h1 className="text-2xl font-semibold">Política de privacidade</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          A 3C OS é um aplicativo pessoal, de um único usuário. Ela guarda notas, resumos e registros enviados pelo
          próprio dono, diretamente ou por meio dos assistentes Claude e ChatGPT autorizados por ele.
        </p>
        <p>
          Os dados ficam em um banco Postgres no Supabase e não são vendidos, compartilhados nem usados para treinar
          modelos. O acesso exige login do dono ou uma chave secreta que só ele possui.
        </p>
        <p>O dono pode exportar ou apagar todos os dados a qualquer momento.</p>
      </div>
    </main>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { FileLock2, ShieldCheck } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { isDemo } from "@/lib/central/demo";
import { PageHeader } from "@/components/shell/page-header";
import { PrivateNoteForm } from "@/components/central/private-note-form";

async function PrivateNotes() {
  const member = await requireMember(),
    demo = isDemo();
  const result =
    demo || !member.central.actor.userId
      ? { data: [], error: null }
      : await member.supabase
          .from("entries")
          .select("id,title,updated_at")
          .eq("owner_id", member.central.actor.userId)
          .eq("ai_access", "private")
          .eq("archived", false)
          .order("updated_at", { ascending: false })
          .limit(50);
  return (
    <div className="space-y-4">
      <section className="glass flex items-start gap-3 rounded-2xl p-5">
        <ShieldCheck className="mt-1 size-6 shrink-0 text-lilac" />
        <div className="space-y-2">
          <h2 className="font-semibold">
            Informações importantes, só para você
          </h2>
          <p className="text-sm text-muted-foreground">
            As notas desta página são privadas e ficam fora das ferramentas das
            IAs da Central. Não há criptografia de ponta a ponta: para senhas e
            códigos de recuperação, use um gerenciador de senhas.
          </p>
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <PrivateNoteForm demo={demo} />
        <section className="glass space-y-4 rounded-2xl p-5">
          <h2 className="text-lg font-semibold">Suas notas privadas</h2>
          {result.error ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar suas notas. Recarregue a página.
            </p>
          ) : result.data?.length ? (
            <ul className="space-y-2">
              {result.data.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/registros/${note.id}`}
                    className="flex min-h-12 items-center gap-3 rounded-xl border p-3 hover:bg-muted/30"
                  >
                    <FileLock2 className="size-4 shrink-0 text-lilac" />
                    <span className="min-w-0 break-words text-sm">
                      {note.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Suas notas privadas aparecerão aqui.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Até 50 notas recentes. Abra uma para ler o conteúdo completo e seu
            histórico. Notas privadas de outras áreas também aparecem aqui.
          </p>
        </section>
      </div>
    </div>
  );
}
export default function SecurePage() {
  return (
    <>
      <PageHeader
        eyebrow="pessoal"
        title="Área segura"
        description="Um lugar para suas informações importantes."
      />
      <Suspense fallback={<p>Carregando notas privadas…</p>}>
        <PrivateNotes />
      </Suspense>
    </>
  );
}

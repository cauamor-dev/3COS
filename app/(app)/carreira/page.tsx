import { Suspense } from "react";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { isDemo } from "@/lib/central/demo";
import { PageHeader } from "@/components/shell/page-header";
import { EntryCard } from "@/components/central/entry-card";
import { EmptyState } from "@/components/ui/empty-state";
import { BriefcaseBusiness, Mail } from "lucide-react";
async function Career() {
  const m = await requireMember();
  const emails = (
    await m.central.searchEntries("importante", { limit: 30 })
  ).items.filter((e) => e.tags.includes("email"));
  const result = isDemo()
    ? { data: [], error: null }
    : await m.supabase
        .from("career_opportunities")
        .select(
          "entry_id,company,role,canonical_url,location,modality,verified_at,requirements,fit_explanation,next_action,status",
        )
        .eq("owner_id", m.central.actor.userId!)
        .order("verified_at", { ascending: false })
        .limit(100);
  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-4 text-sm">
        <p>Candidaturas e mudanças em perfis públicos passam pelo seu ok.</p>
        <Link className="mt-2 inline-block text-lilac" href="/perfil">
          Conferir perfil usado nas avaliações →
        </Link>
      </div>
      <section className="space-y-3">
        <h2 className="font-medium">Vagas e próximos passos</h2>
        {result.error && (
          <p role="alert" className="text-sm text-muted-foreground">
            Não foi possível carregar suas oportunidades. Tente novamente.
          </p>
        )}
        {(result.data ?? []).map((v) => (
          <article className="glass space-y-2 rounded-xl p-4" key={v.entry_id}>
            <Link
              className="font-medium text-lilac"
              href={`/registros/${v.entry_id}`}
            >
              {v.role} · {v.company}
            </Link>
            <p className="text-xs">
              {v.location} · {v.modality} ·{" "}
              {v.verified_at
                ? `Verificação informada em ${new Date(v.verified_at).toLocaleDateString("pt-BR")}`
                : "Fonte ainda não verificada"}
            </p>
            <p className="text-sm">{v.fit_explanation}</p>
            <p className="text-sm text-muted-foreground">
              Próximo passo: {v.next_action}
            </p>
            <a
              className="text-xs text-lilac"
              href={v.canonical_url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir fonte original
            </a>
          </article>
        ))}
        {!result.error && !result.data?.length && (
          <EmptyState icon={BriefcaseBusiness} title="Sua próxima oportunidade" description="Vagas com fonte, compatibilidade e próximo passo aparecem aqui quando forem importadas." />
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">E-mails importantes</h2>
        {emails.map((e) => (
          <EntryCard key={e.id} entry={e} />
        ))}
        {!emails.length && (
          <EmptyState icon={Mail} title="Só o que merece atenção" description="E-mails selecionados pela sua integração aparecem aqui. A conexão Gmail ainda precisa ser validada." compact />
        )}
      </section>
      <section className="glass rounded-xl p-4">
        <h2 className="font-medium">Axial</h2>
        <p className="my-2 text-sm text-muted-foreground">
          Leads e finanças empresariais continuam no Painel Axial. A Central
          acompanha briefing, trabalho e entrega; resumo autenticado aguarda o
          contrato de integração.
        </p>
        <a
          className="text-sm text-lilac"
          href="https://painel-axial.netlify.app"
          target="_blank"
          rel="noreferrer"
        >
          Abrir Painel Axial →
        </a>
      </section>
    </div>
  );
}
export default function CareerPage() {
  return (
    <>
      <PageHeader
        eyebrow="carreira e informação"
        title="Carreira"
        description="Oportunidades, fontes e próximos passos."
      />
      <Suspense fallback={<p>Carregando carreira…</p>}>
        <Career />
      </Suspense>
    </>
  );
}

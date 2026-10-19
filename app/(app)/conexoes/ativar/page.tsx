import { Suspense } from "react";
import Link from "next/link";
import { Bot, Check, KeyRound, Link2, ShieldCheck } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { isDemo } from "@/lib/central/demo";
import { chloeReadiness, chloeStatus } from "@/lib/chloe/llm";
import { claraTestPrompt } from "@/lib/integrations/clara-setup";
import { PageHeader } from "@/components/shell/page-header";
import { CopyBlock, CopyField } from "@/components/connections/copy-field";
import { Button } from "@/components/ui/button";
import { serverEnv } from "@/lib/env";

async function Activation() {
  const member = await requireMember(),
    demo = isDemo(),
    ai = chloeReadiness();
  const fixtures = demo
    ? []
    : ((
        await member.supabase
          .from("entries")
          .select("id,external_id")
          .eq("owner_id", member.central.actor.userId!)
          .in("external_id", [
            "clara-setup-v1-shared",
            "clara-setup-v1-private",
          ])
      ).data ?? []);
  const sharedId = fixtures.find((f) => f.external_id.endsWith("shared"))?.id,
    privateId = fixtures.find((f) => f.external_id.endsWith("private"))?.id;
  return (
    <div className="space-y-5">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="glass min-w-0 space-y-5 rounded-2xl p-5">
          <header className="flex items-center gap-3">
            <span className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-lilac">
              <Link2 className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Clara · Grok Bot</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Única ponte dos bots com a Central
              </p>
            </div>
          </header>
          <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed">
            <li>
              Gere o acesso da <strong>Clara</strong>. Selecione{" "}
              <strong>Axial</strong> e <strong>Validação operacional 3C</strong>
              . Para este primeiro teste, deixe “assumir trabalhos” desmarcado.
            </li>
            <li>
              No aplicativo Grok Bot, configure este MCP{" "}
              <strong>somente para a Clara</strong>. Autenticação Bearer; cole o
              token no segredo do conector.
            </li>
            <li>
              Abra a conversa da Clara e execute o teste abaixo. Se o conector
              for global a todos os bots, deixe a ativação pendente e avise.
            </li>
          </ol>
          <Button asChild className="h-10">
            <Link href="/equipe?tab=connections&connect=clara">
              <KeyRound /> Preparar acesso da Clara
            </Link>
          </Button>
          <CopyField
            label="URL MCP da Clara"
            value={`${serverEnv.appUrl}/api/mcp`}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            O token aparece uma vez. Guarde apenas no segredo do conector. Não
            use a chave administrativa do Supabase nem envie o token neste chat.
          </p>
        </section>
        <section className="glass min-w-0 space-y-5 rounded-2xl p-5">
          <header className="flex items-center gap-3">
            <span className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-lilac">
              <Bot className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Chloe · IA gratuita</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Groq é o provedor; Grok Bot é a Clara
              </p>
            </div>
          </header>
          <p
            role="status"
            className="rounded-xl border bg-muted/20 p-3 text-sm"
          >
            {chloeStatus().message}
          </p>
          <div className="space-y-2 text-sm">
            {[
              ["Chave cadastrada", ai.keyPresent],
              ["Plano gratuito confirmado por você", ai.freeConfirmed],
              ["Avaliação aprovada", ai.evaluated],
              ["IA ativada", ai.active],
            ].map(([label, done]) => (
              <div key={String(label)} className="flex items-center gap-2">
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full border ${done ? "border-primary/40 bg-primary/10 text-lilac" : "text-muted-foreground"}`}
                >
                  {done ? (
                    <Check className="size-3" />
                  ) : (
                    <span className="size-1 rounded-full bg-current" />
                  )}
                </span>
                {label}
              </div>
            ))}
          </div>
          <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed">
            <li>
              Entre na Groq, revise os termos e confirme o plano{" "}
              <strong>Free</strong>. Não habilite Developer nem adicione
              pagamento.
            </li>
            <li>
              Crie uma API key e salve no segredo de ambiente{" "}
              <strong>GROQ_API_KEY</strong> do projeto{" "}
              <strong>central3c-caua</strong> na Netlify. Marque “Contains
              secret values”, mantenha os escopos permitidos e preencha somente
              “Production”. Não é necessário upgrade.
            </li>
            <li>
              Após conferir que a chave é de uma conta Free, salve{" "}
              <strong>CHLOE_FREE_TIER_CONFIRMED = 1</strong> no mesmo projeto.
              Avise o Codex; avaliação e ativação técnica ficam preparadas.
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild className="h-10">
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
              >
                Abrir Groq
              </a>
            </Button>
            <Button variant="outline" asChild className="h-10">
              <a
                href="https://app.netlify.com/projects/central3c-caua/configuration/env"
                target="_blank"
                rel="noreferrer"
              >
                Abrir configuração
              </a>
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Não ligue CHLOE_AI_ENABLED ou CHLOE_EVALUATION_PASSED manualmente. O
            teste usa dados fictícios e pode pausar na cota, sem pagar ou trocar
            de provedor.
          </p>
        </section>
      </div>
      <details className="glass rounded-2xl p-5" open>
        <summary className="cursor-pointer text-sm font-semibold">
          Teste da Clara · depois de configurar o MCP
        </summary>
        <div className="mt-4">
          {sharedId && privateId ? (
            <CopyBlock
              label="Copiar teste para a Clara"
              text={claraTestPrompt({ sharedId, privateId })}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              O teste sintético ainda precisa ser preparado pelo Codex. Nenhum
              dado pessoal será usado.
            </p>
          )}
        </div>
      </details>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />O teste não retoma
        execuções nem publica nada. Ações externas continuam dependendo do seu
        ok. Atualize esta página após alterar a configuração e publicar o novo
        deploy.
      </p>
    </div>
  );
}
export default function ActivationPage() {
  return (
    <>
      <PageHeader
        eyebrow="conexões"
        title="Ativar Clara e Chloe"
        description="Duas conexões, poucos passos e sem contratação nova."
      />
      <Suspense fallback={<p role="status">Conferindo configuração…</p>}>
        <Activation />
      </Suspense>
    </>
  );
}

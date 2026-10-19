import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CopyBlock, CopyField } from "@/components/connections/copy-field";
import { PushToggle } from "@/components/notifications/push-toggle";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { derivedSecret } from "@/lib/http/derived-secret";
import { enabledChannels } from "@/lib/notify/notifier";
import Link from "next/link";

export const metadata: Metadata = { title: "Conexões" };

const readDoc = (name: string) =>
  readFile(path.join(process.cwd(), "docs", name), "utf8");

async function Connections() {
  await requireMember();
  const [gptText, claudeText] = await Promise.all([
    readDoc("gpt-instrucoes.md"),
    readDoc("claude-instrucoes.md"),
  ]);
  const mcpUrl = `${serverEnv.appUrl}/api/mcp/${serverEnv.mcpSecret}`;
  const openApiUrl = `${serverEnv.appUrl}/api/v1/openapi.json`;
  const icsToken = derivedSecret(serverEnv.mcpSecret, "ics");
  const icsUrl = `${serverEnv.appUrl}/api/agenda/${icsToken}.ics`;

  const channels = enabledChannels();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="glass space-y-2 rounded-2xl p-5 lg:col-span-2">
        <h2 className="text-lg font-semibold">Clara e Chloe</h2>
        <p className="text-sm text-muted-foreground">Configuração guiada, teste de conexão e estado real da IA gratuita.</p>
        <Link className="inline-flex min-h-10 items-center text-sm text-lilac" href="/conexoes/ativar">Abrir preparação →</Link>
      </section>
      <section className="glass space-y-2 rounded-2xl p-5 lg:col-span-2">
        <h2 className="font-medium">Conexões individuais da Equipe</h2>
        <p className="text-sm text-muted-foreground">
          Crie um token por agente com áreas e operações delimitadas. Conexões
          antigas continuam durante a migração, com identidade fixa; query
          string e user-agent não comprovam autoria. O plugin administrativo
          Supabase é para manutenção e não isola bots.
        </p>
        <Link className="text-sm text-lilac" href="/equipe">
          Equipe → Conexões e instruções de ativação
        </Link>
        <CopyField
          label="MCP com Bearer individual"
          value={`${serverEnv.appUrl}/api/mcp`}
        />
      </section>
      <section className="glass space-y-4 rounded-2xl p-5 lg:col-span-2">
        <header className="flex flex-wrap items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <h2 className="font-medium">Notificações e lembretes</h2>
          <div className="ml-auto flex flex-wrap gap-1.5 font-mono text-[11px]">
            {(
              [
                ["push", "Push"],
                ["email", "E-mail"],
                ["telegram", "Telegram"],
              ] as const
            ).map(([key, label]) => (
              <span
                key={key}
                className={
                  channels[key]
                    ? "rounded-full border border-emerald-400/40 px-2 py-0.5 text-emerald-300"
                    : "rounded-full border px-2 py-0.5 text-muted-foreground"
                }
              >
                {label}{" "}
                {channels[key]
                  ? "configurado; conferir entrega"
                  : "não configurado"}
              </span>
            ))}
          </div>
        </header>
        <p className="text-sm text-muted-foreground">
          Configure avisos e horários silenciosos em Notificações. A verificação
          ocorre a cada cinco minutos; o resumo diário das 7h é opcional. Push
          precisa ser ativado em cada aparelho.
        </p>
        <PushToggle />
        <Link href="/notificacoes" className="text-sm text-lilac">
          Abrir avisos e preferências
        </Link>
      </section>

      <section className="glass space-y-4 rounded-2xl p-5">
        <header className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-claude" />
          <h2 className="font-medium">Claude · conector MCP</h2>
        </header>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            claude.ai → Configurações → Conectores → Adicionar conector
            personalizado.
          </li>
          <li>Nome: 3C OS. URL: a de baixo. Deixe OAuth em branco.</li>
          <li>
            Ative o conector na conversa (ícone de ferramentas) e cole as
            instruções nos seus Projetos.
          </li>
        </ol>
        <CopyField
          label="URL do conector"
          value={mcpUrl}
          secret={serverEnv.mcpSecret}
        />
        <CopyBlock
          label="Instruções para Projetos / preferências"
          text={claudeText.trim()}
        />
      </section>

      <section className="glass space-y-4 rounded-2xl p-5">
        <header className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-chatgpt" />
          <h2 className="font-medium">ChatGPT · GPT com Actions</h2>
        </header>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            chatgpt.com → Explorar GPTs → Criar → Configurar. Nome: 3C OS.
          </li>
          <li>
            Cole as instruções. Em Ações → Criar ação → Importar de URL com o
            OpenAPI.
          </li>
          <li>
            Autenticação: Chave de API, tipo Bearer, cole a API key. Compartilhe
            só com você.
          </li>
        </ol>
        <CopyField label="URL do OpenAPI" value={openApiUrl} />
        <CopyField
          label="API key"
          value={serverEnv.apiKey}
          secret={serverEnv.apiKey}
        />
        <CopyBlock label="Instruções do GPT" text={gptText.trim()} />
      </section>

      <section className="glass space-y-4 rounded-2xl p-5 lg:col-span-2">
        <header className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-lilac" />
          <h2 className="font-medium">Agenda no calendário do celular</h2>
        </header>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Google Agenda (no computador): Outras agendas → + → Do URL → cole o
            link abaixo. Aparece no app do celular em alguns minutos.
          </li>
          <li>
            iPhone: Ajustes → Calendário → Contas → Adicionar conta → Outra →
            Adicionar calendário assinado → cole o link.
          </li>
          <li>
            Os calendários atualizam sozinhos (o Google pode levar algumas
            horas). É só leitura: crie e edite pela Central ou pelas IAs.
          </li>
        </ol>
        <CopyField
          label="link da agenda (ICS)"
          value={icsUrl}
          secret={icsToken}
        />
      </section>

      <section className="glass space-y-3 rounded-2xl p-5 lg:col-span-2">
        <h2 className="font-medium">Testar o MCP localmente</h2>
        <p className="text-sm text-muted-foreground">
          Rode o MCP Inspector e conecte em Streamable HTTP com a URL do
          conector.
        </p>
        <CopyField
          label="comando"
          value="npx @modelcontextprotocol/inspector"
        />
      </section>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="conexões"
        title="Ligue suas IAs na Central"
        description="Os segredos ficam mascarados. Quem tiver a URL do conector ou a API key lê e grava na sua Central."
      />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" />}
      >
        <Connections />
      </Suspense>
    </>
  );
}

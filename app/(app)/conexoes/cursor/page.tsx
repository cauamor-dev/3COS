import { Suspense } from "react";
import Link from "next/link";
import { Code2, KeyRound } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { CopyBlock } from "@/components/connections/copy-field";

async function CursorGuide() {
  await requireMember();
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className="glass space-y-5 rounded-2xl p-5">
        <header className="flex items-center gap-3">
          <Code2 className="size-6 text-lilac" />
          <h2 className="text-xl font-semibold">Cursor · desenvolvimento</h2>
        </header>
        <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed">
          <li>
            Gere o acesso individual do <strong>Cursor</strong>. Comece apenas
            com <strong>Validação operacional 3C</strong>. Deixe “assumir
            trabalhos” desmarcado durante o teste.
          </li>
          <li>
            No Cursor, abra a pasta do projeto. O arquivo{" "}
            <code>.cursor/mcp.json</code> já aponta para a Central, sem conter
            segredo.
          </li>
          <li>
            Execute no PowerShell da pasta do projeto:{" "}
            <code className="break-all">
              powershell -File scripts/configure-cursor-token.ps1
            </code>
            . Cole o token no campo oculto.
          </li>
          <li>
            Feche completamente e reabra o Cursor. Em Configurações → MCP,
            confira o servidor <strong>central-3c</strong>. Mantenha a
            confirmação das ferramentas.
          </li>
        </ol>
        <Button asChild className="h-10">
          <Link href="/equipe?tab=connections&connect=cursor">
            <KeyRound /> Preparar acesso do Cursor
          </Link>
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          O token fica no ambiente do seu usuário Windows, acessível aos
          processos desse usuário. Não é um cofre criptografado. Revogue em
          Equipe se houver exposição. Não use chave administrativa Supabase nem
          a chave Groq.
        </p>
      </section>
      <section className="glass space-y-5 rounded-2xl p-5">
        <h2 className="text-xl font-semibold">Primeiro teste</h2>
        <CopyBlock
          label="Pedido para o Cursor"
          text={
            "Use somente o MCP central-3c. Chame equipe_diagnostico e confirme que sua identidade é Cursor, fonte cursor, e que só possui as áreas concedidas. Não leia perfil, inbox, notas privadas ou finanças. Leia a área validacao-3c e salve nela um registro progresso sintético com título “Cursor — conexão verificada”, external_id único e uma descrição da leitura real. Devolva o ID confirmado. Se faltar ferramenta, autenticação ou permissão, informe sem simular sucesso. Não assuma trabalhos nem execute ações externas."
          }
        />
        <p className="text-sm text-muted-foreground">
          Depois de validar, conceda somente os projetos necessários. O fluxo
          Nox → Vega → Cursor → Vega → Nox é assistido: as ferramentas não
          acionam automaticamente os outros aplicativos.
        </p>
        <p className="text-sm text-muted-foreground">
          O documento completo está no projeto:{" "}
          <code>docs/CONTINUAR-NO-CURSOR.md</code>. Nenhum plano pago ou Cloud
          Agent precisa ser ativado.
        </p>
      </section>
    </div>
  );
}
export default function CursorPage() {
  return (
    <>
      <PageHeader
        eyebrow="conexões"
        title="Cursor"
        description="Uma identidade própria, com acesso aos projetos escolhidos."
      />
      <Suspense fallback={<p>Carregando instruções…</p>}>
        <CursorGuide />
      </Suspense>
    </>
  );
}

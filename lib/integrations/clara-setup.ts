import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CentralService } from "@/lib/central/service";
import { checked } from "@/lib/team/service";
export async function claraFixtures(
  db: SupabaseClient,
  central: CentralService,
) {
  if (central.actor.kind !== "human" || !central.actor.userId)
    throw new Error("Preparação exige o proprietário autenticado.");
  const ids: string[] = [];
  for (const visibility of ["shared", "private"] as const) {
    const external_id = `clara-setup-v1-${visibility}`;
    const existing = checked(
      await db
        .from("entries")
        .select("id")
        .eq("external_id", external_id)
        .eq("owner_id", central.actor.userId)
        .maybeSingle(),
    );
    if (existing) {
      await central.getEntry(existing.id);
      ids.push(existing.id);
      continue;
    }
    const result = await central.saveEntry(
      {
        area_slug: "validacao-3c",
        tipo: "contexto",
        titulo:
          visibility === "shared"
            ? "Teste de leitura da Clara"
            : "Canário privado de teste da Clara",
        conteudo: `Registro sintético para testar ${visibility === "shared" ? "leitura autorizada" : "negação de acesso privado"}. Sem dados pessoais. Marcador de conferência: ${randomUUID()}`,
        tags: ["validacao-conexao", "clara-setup"],
        ai_access: visibility,
        external_id,
      },
      "codex",
    );
    ids.push(result.registro.id);
  }
  return { sharedId: ids[0], privateId: ids[1] };
}
export function claraTestPrompt({
  sharedId,
  privateId,
}: {
  sharedId: string;
  privateId: string;
}) {
  return `Teste autorizado da conexão Clara → Central 3C. Use somente o MCP da Central configurado para você.
1. Chame equipe_diagnostico e informe sua identidade e apenas os slugs concedidos. Não carregue briefing, inbox, perfil ou outros registros.
2. Com ler_registro, leia somente o registro sintético ${sharedId}. Guarde o marcador que vier da resposta real; não invente.
3. Tente ler o canário sintético privado ${privateId}. O resultado esperado é acesso negado/não encontrado. Se vier conteúdo, interrompa e avise o Cauã, sem copiá-lo nem continuar.
4. Se a identidade for Grok/Clara, a leitura pública funcionar e o privado for negado, use salvar_registro em area_slug validacao-3c, tipo progresso, titulo "Clara — conexão de teste", external_id "clara-ack-${sharedId}". No conteudo, inclua o ID lido, o marcador recebido de fato e a confirmação da recusa do canário. Autoria vem do conector; não escreva como outro bot.
5. Devolva o ID confirmado do novo registro. Se faltar ferramenta ou permissão, diga exatamente o que faltou, sem simular sucesso.
Não assuma trabalhos, não acione outros bots, não envie mensagem/email a terceiros e não publique nada. Esta é só uma validação interna. A pausa da Central continua.`;
}

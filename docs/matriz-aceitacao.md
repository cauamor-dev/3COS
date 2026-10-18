# Matriz de aceitação T01–T26

18/10/2026. Validado significa executado no âmbito descrito. Parcial registra o que falta; não executado não conta como integração. Dados reais em .local-reports/.private-backups são ignorados pelo Git; fixtures não comprovam produtos externos.

| ID | Estado | Evidência e limite |
|---|---|---|
| T01 | Parcial | Desktop/390×844, demo funcional e modo leve/sem animações conferidos; iPhone físico/PWA/push não executados. |
| T02 | Validado no escopo | Detalhes estáveis, voltar com fallback, referências e teclado das notícias; jornada sanitizada no navegador. Nota sensível não aberta. |
| T03 | Parcial | Login humano real no preview, sessão autenticada, allowlist/origem/redirects testados. Produção aguarda quota SMTP; expiração por contratos, sem espera integral no navegador. |
| T04 | Validado no escopo | Agenda/fuso/recorrência/CRUD testados; tarefa HTTPS criada/concluída e avisos recorrentes em PostgreSQL isolado. |
| T05 | Validado | privacy/database: revisão velha rejeitada sem sobrescrita silenciosa. |
| T06 | Validado | chloe-capture e navegador: original longo, ambiguidade não vira vigia, limite explícito não trunca. |
| T07 | Validado no escopo | Sugestão sem exclusão, manter dois ou complementar pelo editor, histórico/restauração. Sem fusão automática. |
| T08 | Parcial | Busca/contexto filtrados e referências testados; modelo não executado sem chave grátis/avaliação. |
| T09 | Parcial | Sem chave e gates testados; timeout/429 de provedor real não executados. Nenhum fallback pago. |
| T10 | Validado | privacy/database + HTTPS: busca/exportação/briefing filtrados; nota sensível negada sem ler conteúdo e arquivo privado negado. Consulta real do resumo nega private/restricted. |
| T11 | Validado | REST ignora source forjado, SQL atribui system; servidor/banco recusam outro cliente Grok que não Clara. |
| T12 | Validado | PostgreSQL: criação/quota transacionais, posse única/idempotência; repetição HTTPS não duplica fila. |
| T13 | Validado | Lease expirado recuperado, fence antiga rejeitada, entrega repetida idempotente em PostgreSQL. Outra IA não simulada como real. |
| T14 | Validado | Conteúdo/destino/anexos amarrados, alteração rejeitada, uso único, lote atômico com rollback se peça mudou. |
| T15 | Parcial | uncertain/posse e push incerto impedem retry automático; nenhum envio externo real com falha ambígua, adaptadores não ativados. |
| T16 | Não executado | Nenhum efeito externo nativo disparado para teste; política preserva aprovação da plataforma, sem bypass. |
| T17 | Validado no escopo | MP4 real: reserva/upload/finalização/hash/download iguais, MIME/tamanho/privacidade negados. Assinatura curta renovada; espera real de dez minutos não executada; links longos antigos preservados. |
| T18 | Validado | Importação remota arbitrária desativada; remote-image rejeita antes de acessar rede. |
| T19 | Validado no escopo | Dois ticks HTTPS deduplicam avisos; PostgreSQL testa quota/repetição. Nenhuma rotina Grok criada para simular webhook. |
| T20 | Não executado | Usuário configura conector no aplicativo Grok Bot, sem controle nativo nesta sessão. Clara→Central→executor aguarda handshake real; Codex→Central não substitui Grok. |
| T21 | Parcial | Vega leu/escreveu pelo MCP; Nox pelo Supabase Work, fonte system. Falta conversa Equipe por clientes individuais/autoria comprovada. |
| T22 | Parcial | Sem runner, código aguarda executor; cron/nuvem independentes comprovados. PC não foi desligado fisicamente para teste. |
| T23 | Parcial | Contratos de vaga/email com URL/data/lacunas/idempotência; fontes reais inacessíveis/stale não importadas só para testar; identidade Gmail deve ser conferida. |
| T24 | Validado | finance/PostgreSQL: BOM/aspas/decimal/inválidos, reimportação idempotente, despesas iguais mantidas, aviso entre arquivos e RLS do dono. |
| T25 | Parcial | Pausa/fencing testados; pausa real restaurada. Cliente temporário revogado e 401 real nos dois hosts. Backup restaurado isoladamente sem down migration. Não voltou produção a código inseguro só para testar rollback. |
| T26 | Parcial | Preview/produção com MCP/REST/arquivo/cron/avisos aprovados, callbacks/Site URL/Vault ajustados, primeiro callback 200. Vercel Ready com MCP/REST individuais/legados, privacidade e arquivo testados. Login humano definitivo aguarda quota SMTP. |

Suíte: 136 testes em 23 arquivos. Smoke HTTPS: integração 9, arquivos 10, notificações 9; consulta real do resumo 4. Vinte casos de avaliação Chloe preparados: **zero avaliações reais executadas**, modelo desligado. Push sem aparelho cadastrado: **recebimento não comprovado**.

# Plano de viabilidade: custos, riscos e trilha

_Outubro de 2026._ Objetivo: transformar a Central 3C no ambiente pessoal completo (memória das IAs, agenda, tarefas, notas, anexos, lembretes e conversa por mensagem) **mantendo custo zero sempre que possível**, e saber exatamente quando e por que pagar.

## 1. Mapa de custos

| Serviço | Para quê | Limite gratuito | Uso estimado | Folga |
| --- | --- | --- | --- | --- |
| Vercel Hobby | Painel, API, MCP | 100 GB de banda, funções ilimitadas para uso pessoal, 2 crons/dia | < 1 GB/mês | Enorme |
| Supabase Free | Banco, auth, realtime, arquivos, agendador | 500 MB de banco, 1 GB de arquivos, `pg_cron`, `pg_net`, `vector` | ~5 MB de banco; arquivos dependem de você | Banco: anos. Arquivos: atenção com fotos |
| Telegram Bot API | Lembretes e conversa | Gratuito, sem limite prático | Dezenas de mensagens/dia | Total |
| Web Push (PWA) | Notificação no celular sem app extra | Gratuito, sem conta | — | Total |
| Resend | Resumo diário por e-mail | 100 e-mails/dia, 3.000/mês (só para o seu próprio e-mail sem domínio) | 1 a 3/dia | Enorme |
| GitHub | Código e backup diário | Repositórios privados gratuitos | — | Total |

**Total hoje: R$ 0/mês.**

## 2. Onde talvez valha pagar (e quanto)

| Item | Quando faria sentido | Custo aproximado | Recomendação |
| --- | --- | --- | --- |
| **IA para conversar com a Central** (Telegram e painel) | Para falar em linguagem natural ("me lembra amanhã às 9h de ligar pro Lott") | **Gemini Flash grátis**: poucas requisições por dia e o Google pode usar seus dados para treino. **API paga** (Gemini/OpenAI, modelos pequenos): centavos por dia, ~R$ 5 a 15/mês com teto configurado | Começar com **comandos sem IA** (grátis e privado). Depois, API paga com teto de gastos, porque a Central guarda dados pessoais |
| **WhatsApp oficial** (Meta Cloud API) | Se quiser receber e conversar pelo WhatsApp em vez do Telegram | Respostas em até 24 h são grátis; lembretes iniciados pelo sistema custam ~R$ 0,035 cada (~R$ 3 a 5/mês). Exige conta Meta Business, **um número dedicado** (não o seu pessoal) e modelos aprovados | **Telegram primeiro.** WhatsApp como fase opcional; serviços "grátis" não oficiais (ex.: CallMeBot) vivem sendo bloqueados |
| **Domínio próprio** (ex.: `central3c.com.br`) | E-mail com remetente próprio, URL bonita no portfólio | ~R$ 40/ano | Opcional, quando virar produto |
| **Supabase Pro** | Backups automáticos, sem pausa, mais espaço | US$ 25/mês | **Não precisa.** Backup diário no GitHub + keepalive resolvem |
| **Vercel Pro** | Crons de minuto, mais limites | US$ 20/mês | **Não precisa.** O `pg_cron` do Supabase faz o agendamento fino de graça |

**Conclusão:** dá para manter tudo grátis. O único gasto que **recomendo** no futuro é uma API de IA paga com teto (~R$ 10/mês), quando você quiser conversar em linguagem natural com a Central sem entregar seus dados pessoais para treino.

## 3. O que pode dar errado

| Risco | Probabilidade | Impacto | Mitigação | Sinal de alerta |
| --- | --- | --- | --- | --- |
| Supabase Free pausa por inatividade | Baixa | Alto (tudo para) | Cron diário de keepalive + `pg_cron` rodando a cada 5 min | E-mail do Supabase avisando pausa |
| Perda de dados (erro de IA, bug, exclusão) | Média | Alto | Versões, lixeira, backup diário no GitHub | Registros sumindo do painel |
| IA grava informação errada ou duplicada | Alta | Médio | Revisão semanal automática, fonte de cada escrita, desfazer | Briefing com fatos contraditórios |
| GPTs desligados em 11/12/2026 | Certa | Médio | Plugin Supabase no Work (já funciona); plugin MCP quando o Plus liberar | Aviso no ChatGPT |
| Plugin Supabase com acesso amplo ao banco | Baixa | Alto | Habilidade restrita a `central.*`, aprovação do Work, lixeira | SQL fora de `central.*` no histórico |
| Vazamento da URL do MCP ou da API key | Baixa | Alto | Segredos longos, rotação em 2 minutos (`npm run secrets` + env na Vercel) | Registros que você não reconhece |
| Mudanças de plataforma (OpenAI, Anthropic, Supabase, Vercel) | Alta | Médio | Camada de serviço única: trocar um canal não mexe nas regras | Release notes e e-mails de "breaking change" |
| Arquivos enchendo 1 GB | Média (com fotos) | Médio | Compressão de imagens no upload + aviso no painel a 80% | Indicador de uso no painel |
| Bot do Telegram recebendo mensagens de estranhos | Baixa | Médio | Aceitar só o seu chat ID; webhook com segredo | Tentativas registradas no log |
| Dados pessoais sensíveis expostos às IAs | Média | Alto | Área "cofre" fora do briefing e das ferramentas das IAs; nunca guardar senhas (use um gerenciador) | — |

## 4. Trilha de construção

| Fase | Entrega | Depende de você |
| --- | --- | --- |
| **1. Agenda e tarefas** | Eventos, prazos, recorrência, tarefas com conclusão, abas Agenda e Tarefas, ferramentas para as IAs, feed ICS para o calendário do celular | Nada |
| **2. Lembretes e resumo diário** | `pg_cron` a cada 5 min, push no celular, e-mail diário com a agenda | Criar conta no Resend (2 min) |
| **3. Telegram** | Bot para receber lembretes e mandar notas/tarefas por comandos (`/nota`, `/tarefa`, `/hoje`, `/buscar`) | Criar o bot no @BotFather (1 min) |
| **4. Anexos e notas** | Imagens e arquivos nos registros, compressão, galeria; área "cofre" para informações pessoais | Nada |
| **5. Confiabilidade** | Backup diário no GitHub, revisão semanal automática, indicador de saúde no painel | Nada |
| **6. Conversa com IA** | Linguagem natural no Telegram e no painel ("parceiro") | Escolher: Gemini grátis (dados para treino) ou API paga com teto |
| **7. Alcance** | WhatsApp oficial (opcional), plugin MCP no ChatGPT, app de celular/desktop | Decisões de custo |

## 5. Checklist mensal (10 minutos)

1. Abrir o painel e conferir o indicador de saúde (banco, arquivos, último backup, último lembrete enviado).
2. Esvaziar a inbox: mover, confirmar ou arquivar.
3. Ler a última "Revisão da semana" e corrigir fatos errados.
4. Conferir se as datas de 11/12 (GPTs) e outras mudanças anunciadas exigem ação.

## Fontes

- [WhatsApp Business API pricing 2026 (Sleekflow)](https://sleekflow.io/blog/whatsapp-business-price)
- [WhatsApp Business API pricing in Brazil (Flowcall)](https://flowcall.co/blog/whatsapp-business-api-pricing-2026)
- [CallMeBot: relatos de bloqueios (Simon42)](https://community.simon42.com/t/keine-benachrichtigungen-mehr-per-whatsapp/74836)
- [Resend: account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- [Resend: 403 on resend.dev domain](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- [Gemini free tier limits (How-To Geek)](https://www.howtogeek.com/gemini-slashed-free-api-limits-what-to-use-instead/)
- [Gemini free tier and training on data (BSWEN)](https://docs.bswen.com/blog/2026-03-23-gemini-free-tier-data-privacy/)
- [Supabase Edge Functions limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase free tier limits 2026 (Automation Atlas)](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)

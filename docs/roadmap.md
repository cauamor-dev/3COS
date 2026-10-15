# Estudo comparativo e roadmap

_Outubro de 2026._ Onde a 3C OS está em relação a ferramentas de memória para IA e o que vale construir a seguir.

## O cenário

| Ferramenta | Modelo | Claude | ChatGPT | Pontos fortes | Limites |
| --- | --- | --- | --- | --- | --- |
| **Memória nativa do Claude** | Entradas categorizadas, automáticas | ✅ | ❌ | Zero esforço | Presa ao Claude; o ChatGPT não vê |
| **Memória nativa do ChatGPT** | Memórias salvas + histórico de chats | ❌ | ✅ | Zero esforço | Presa ao ChatGPT; opaca, difícil de auditar |
| **Mem0** | API de memória para devs (fatos por usuário) | via MCP | não confirmado | Maior comunidade | Feito para quem constrói apps; não modela validade no tempo |
| **Supermemory** | MCP hospedado com espaços pessoais e de equipe | ✅ | não confirmado | Mais próximo de "memória entre clientes" | Benchmarks contestados; dados em terceiros |
| **Basic Memory** | Notas Markdown locais + grafo de links (Obsidian) | ✅ | ❌ | Dados legíveis, offline | Local; sync na nuvem é pago; consome muitos tokens |
| **Zep / Graphiti** | Grafo temporal de fatos | via API | via API | Fatos que mudam com o tempo | Complexo para uso pessoal |
| **OpenMemory (Mem0)** | MCP local | — | — | — | **Descontinuado** em jul/2026 |
| **3C OS** | Áreas com resumo vivo + linha do tempo + versões | ✅ MCP | ✅ GPT Actions + plugin Supabase (Work) | Dados seus, auditáveis, custo zero, painel ao vivo, histórico desfazível | Busca só por palavras; sem prazos/tarefas; manutenção própria |

**Conclusão:** nenhuma das ferramentas encontradas cobre Claude **e** ChatGPT (inclusive o Work) com escrita, painel próprio e custo zero. O diferencial do 3C OS é ser **curada e auditável**: resumo canônico por área, fonte de cada escrita e desfazer. O que as outras fazem melhor é **recuperação** (busca semântica), **ciclo de vida** (validade e expiração de fatos) e **rotinas automáticas**.

## Boas práticas encontradas (e como o 3C OS se sai)

| Prática | Status |
| --- | --- |
| Instruções curtas que apontam para onde o contexto mora | ✅ skills e instruções já fazem isso |
| Separar tipos de memória (preferências, projetos, decisões, pendências) | ✅ perfil, preferências, áreas e tipos de registro |
| Carregar sob demanda em vez de despejar tudo | ✅ briefing enxuto, truncamento, `ler_registro` |
| Rotina de início de sessão (identidade, resumo recente, pendências) | 🟡 o briefing existe, mas não traz pendências nem prazos |
| Usuário vê, edita e apaga o que a IA sabe | ✅ painel + histórico + lixeira |
| Revisar memórias periodicamente (IAs gravam inferências erradas) | ❌ não há rotina de revisão |
| Validade no tempo / expiração | ❌ |
| Busca híbrida (palavra-chave + semântica) | 🟡 só palavra-chave (full-text em português) |

## Visão: o 3C OS como "terceira IA"

O 3C OS deixa de ser só memória das IAs e vira o **ambiente pessoal do Cauã**: agenda, tarefas, notas, informações importantes e anexos num só lugar, lidos e escritos por ele, pelo Claude e pelo ChatGPT. Ela também **toma iniciativa**: lembra, avisa e resume, sem custo.

| Peça | Como fazer de graça |
| --- | --- |
| Agenda, tarefas e lembretes | Colunas de data em `entries` (evento, prazo, lembrete) + `pg_cron` do Supabase disparando a cada 5 min |
| Notificações | Web Push do PWA (sem conta) e bot do Telegram (gratuito) |
| E-mail (resumo diário) | Resend, plano gratuito (100 e-mails/dia) |
| Calendário do celular | Feed ICS com URL secreta, assinado no Google Agenda ou no iPhone |
| Imagens e anexos | Supabase Storage (1 GB no Free) |
| Captura rápida | Mensagem para o bot do Telegram vira registro na inbox |
| Assistente dentro do painel (futuro) | API gratuita (ex.: Gemini Flash); exige decisão: no plano gratuito o Google pode usar os dados para treino |
| App de celular e desktop (futuro) | PWA já instalável; depois Capacitor/Tauri reaproveitando o mesmo código |

## Roadmap priorizado

### Fase 1: rotina e tarefas (maior impacto no dia a dia)
1. **Tarefas com prazo e status.** Registros do tipo `tarefa` ganham `prazo` e `concluida`; nova ferramenta `listar_tarefas` (MCP, REST e SQL); aba **Tarefas** no painel com vencidas, hoje e semana. Hoje as pendências ficam espalhadas em textos.
2. **Briefing com pendências.** O briefing passa a trazer tarefas vencidas e próximas, além de áreas paradas há mais de 14 dias ou sem resumo.
3. **Revisão semanal automática.** Uma tarefa agendada no Claude ou no ChatGPT lê o briefing toda sexta, escreve um registro "Revisão da semana" e aponta o que está desatualizado. Não exige código, só o prompt certo.
4. **Perfil de interação.** Seções padronizadas em `preferencias` (tom, formato, nível técnico, quando perguntar antes de agir, modos estudo/trabalho/foco), lidas por todas as IAs.

### Fase 2: qualidade da memória
5. **Validade de fatos.** Campo `valido_ate` e ação "substituir registro", que liga o novo ao antigo e tira o antigo das leituras, para fatos que mudam (salário, stack, status de processo seletivo).
6. **Revisão de inbox e de inferências.** Painel com "registros para revisar" (inbox + registros de IA não confirmados) e ação rápida de mover, confirmar ou arquivar.
7. **Backup diário fora do Supabase.** O cron exporta o JSON para um repositório privado no GitHub. O plano Free não tem backups acessíveis.

### Fase 3: recuperação melhor
8. **Busca semântica.** pgvector + embeddings. O modelo gratuito do Supabase (`gte-small`) é treinado só em inglês, o que piora resultados em português; avaliar antes de adotar.
9. **Ligações explícitas entre registros** ("relacionado a", "substitui"), aparecendo no Cérebro.

### Fase 4: alcance
10. **Plugin MCP no ChatGPT** quando o Plus liberar MCP próprio, substituindo o GPT, que será desligado em 11/12/2026.
11. **Captura rápida pelo celular**: atalho do iOS/Android que manda texto para a inbox via API.
12. **Multiusuário com OAuth**, se o 3C OS virar produto.

## Riscos acompanhados

- **GPTs desligados em 11/12/2026.** O ChatGPT segue lendo e gravando pelo plugin Supabase (Work) e, no futuro, pelo plugin MCP.
- **Plugin Supabase com acesso amplo.** Mitigado pela habilidade que só permite chamar funções `central.*`, pelas versões e pela lixeira.
- **Supabase Free pausa após 7 dias sem uso.** Mitigado pelo cron diário de keepalive.
- **Mudança da Data API do Supabase em 30/10/2026.** Mitigada pelos grants explícitos (`20261015010000_explicit_grants.sql`).

## Fontes

- [Best MCP Memory Servers in 2026 (Coworker)](https://coworker.ai/blog/best-mcp-memory-servers)
- [Best AI Agent Memory Frameworks in 2026 (Atlan)](https://atlan.com/know/best-ai-agent-memory-frameworks-2026/)
- [Best AI agent memory tools in 2026 (Braintrust)](https://www.braintrust.dev/articles/best-ai-agent-memory-tools-2026)
- [Mem0 vs Supermemory vs Hjarni (Hjarni)](https://hjarni.com/blog/mem0-vs-supermemory-vs-hjarni)
- [Mem0 Alternatives (Sentra)](https://www.sentra.app/articles/mem0-alternatives)
- [Basic Memory: Technical Information](https://docs.basicmemory.com/technical/technical-information)
- [The Complete Guide to AI Agent Memory in 2026 (Sedim3nt)](https://sedim3nt.substack.com/p/the-complete-guide-to-ai-agent-memory)
- [AI Memory in 2026: persistent assistant setup (AI Magicx)](https://www.aimagicx.com/blog/ai-memory-persistent-assistant-setup-guide-2026)
- [AI inference in Supabase Edge Functions (Supabase)](https://supabase.com/blog/ai-inference-now-available-in-supabase-edge-functions)
- [Breaking Change: tables not exposed to the Data API automatically (Supabase)](https://github.com/orgs/supabase/discussions/45329)

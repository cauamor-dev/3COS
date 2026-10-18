# 3C OS: instruções para o Claude Code

Leia também `AGENTS.md`: este projeto usa **Next.js 16.4**, que tem APIs diferentes do que você conhece. Consulte `node_modules/next/dist/docs/` antes de usar uma API nova.

## Quem e o quê

- Projeto pessoal do **Cauã**, dev full stack que quer virar engenheiro de IA. **Responda sempre em português do Brasil.**
- **3C OS** é o "Jarvis" dele: uma memória compartilhada entre Claude e ChatGPT, mais um painel pessoal (agenda, tarefas, lembretes, notícias, perfil, arquivos) com uma assistente própria. Toda decisão de produto deve servir a esse fluxo: abrir o app, ouvir "Bom dia, Cauã. O que você quer hoje?" e pedir em linguagem natural.
- **Agentes:** Chloe (IA do próprio 3C OS, feminina, cor `#a78bfa`, fonte `manual` por enquanto), Vega (Claude, via MCP, fonte `claude`, `#f0a875`) e Nox (ChatGPT, via GPT Actions e plugin do Supabase no modo Work, fonte `chatgpt`, `#7ee0b0`). Hierarquia: Cauã → 3C OS/Chloe → Vega → Nox → ferramentas.
- **Visual:** preto, branco e roxo, com toque estelar discreto. Outras cores só para alertas. Mobile first: ele usa todo dia como PWA no iPhone 13. Teste em 390x844 (sem rolagem lateral, respeitando as áreas seguras) e em 1440x900.
- **Produção:** https://central3c-caua.netlify.app (login só do Cauã). Host Vercel preservado para transição dos consumidores. **Repositório público:** https://github.com/cauamor-dev/3COS.

## Regras obrigatórias

1. **Commits sem a linha `Co-Authored-By`.** O Cauã quer ser o único autor.
2. **Autor dos commits:** use `57526152+cauamor-dev@users.noreply.github.com` (e-mail privado do GitHub), nunca o e-mail pessoal.
3. **O repositório é público.** Nunca versione segredos, `.env.local`, dados pessoais, nem nomes de sistemas do trabalho dele (o sistema do trabalho aparece nos exemplos como "Orion").
4. Antes de cada entrega: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` e `npx next build` precisam passar.
5. Nunca crie contas, insira senhas ou chaves, gaste dinheiro, nem apague dados de produção. O que depender disso fica anotado para o Cauã fazer.
6. Qualidade de app usado todo dia: nada poluído ou "meio pronto" na interface.

## Stack e mapa do código

- Next.js 16.4 (App Router, `cacheComponents`, `partialPrefetching`, `proxy.ts` no lugar de middleware), React 19.3 com React Compiler, Tailwind 4, shadcn/ui, Motion, Zod 4, Vitest.
- Supabase: Postgres com RLS (`public.is_member()`), Realtime, Vault, `pg_cron` + `pg_net` (lembretes a cada 5 min, notícias a cada 30 min, resumo diário), Storage (bucket privado `arquivos`, links assinados de longa duração).
- `lib/central/service.ts`: núcleo de regras (CentralService), usado por MCP, API REST, Server Actions, bot do Telegram e Chloe. `lib/central/operations.ts` lista as ferramentas das IAs.
- `app/api/mcp/[secret]`: servidor MCP. `app/api/v1/[...path]` + `lib/api/openapi.ts`: API REST e OpenAPI do GPT. `supabase/migrations`: funções `central.*` para o plugin do Supabase no ChatGPT.
- `lib/chloe/`: interpretador de comandos em português (`command.ts`, funciona sem IA), agente com ferramentas (`agent.ts`) e roteador de modelos abertos (`llm.ts`: Groq, OpenRouter, Cloudflare; só liga com chave).
- `lib/news/`: coleta RSS, leitura, ranking e store. `lib/files/`: armazenamento de arquivos. `lib/telegram/bot.ts`: bot. `lib/notify/`: push, Telegram e e-mail.
- Páginas em `app/(app)/`. Os carregadores das abas principais usam `"use cache: private"` + `cacheLife(PAGE_DATA_LIFE)` + `getCachedMember()` (veja `app/(app)/page.tsx`), para as abas abrirem já com dados.
- **Modo demo:** `npm run dev:demo` (porta 3001) roda com dados fictícios em memória, sem login. Use para testar e tirar prints.

## Como publicar

Desde 18/10/2026 a Central usa Netlify, com projeto separado do Painel Axial. Seguir `docs/operations/release-recovery.md`: preview Linux com adaptador Next explícito, validação real e promoção do deploy validado. Preservar compatibilidade das conexões antigas; não duplicar cron. As instruções Vercel abaixo são do host legado.

- **Banco:** migrações novas em `supabase/migrations/`, aplicadas com `npx supabase db push --linked` (exige `SUPABASE_ACCESS_TOKEN` e a senha do banco no ambiente).
- **App (Vercel, plano grátis):** o projeto está ligado ao GitHub, então **um push para `main` publica sozinho** (região São Paulo). Numa sessão do Claude Code no navegador, entregue no `main` (ou num PR que o Cauã aprova) e confira depois se o deploy ficou "Ready".
- Se precisar publicar pela CLI: `vercel deploy` feito de dentro do repositório é bloqueado no plano grátis, porque o autor dos commits é o e-mail privado. Publique uma cópia sem metadados do Git: `git archive HEAD | tar -x -C /tmp/deploy`, copie `.vercel/` para lá e rode `npx vercel deploy --prod --yes`.

## Estado atual (16/10/2026)

Pronto e em produção: memória compartilhada (MCP, OpenAPI, plugin do Supabase); áreas, registros e versões; agenda com recorrência e feed ICS; tarefas com prioridade; lembretes (push, Telegram, e-mail); Mural; notícias RSS (18 fontes, ranking por interesses, leitor no app, "ler traduzida"); Início em blocos (Painel) + Feed; Chloe (saudação, comandos por texto e voz, vigia de preços, delegação para Vega/Nox, IA opcional); alertas automáticos quando Vega/Nox salvam algo urgente; Perfil (alimenta o briefing) com envio de currículo; imagens e arquivos (anexar, colar ou arrastar no Novo e no campo da Chloe, fotos e arquivos pelo Telegram, cópia das imagens das IAs com cada redirecionamento conferido); cadastro fechado no login; Cérebro em galáxia; licença AGPL-3.0; mais de 100 testes.

## Próximas tarefas (em ordem)

1. **Ordenação:** tudo do mais recente para o mais antigo por padrão (tarefas, registros, notícias, Mural, áreas), com um controle para inverter, lembrado por tela.
2. **Tela "Arquivos":** tudo que foi enviado, com busca, filtro por tipo e prévia; anexar arquivo em registro já existente.
3. **Vagas que combinam com o Cauã:** tópico "Vagas" nas notícias (fontes RSS de vagas de tecnologia, filtradas por stack, nível e remoto).
4. **E-mails importantes:** tarefa agendada da Vega com o conector do Gmail do Claude, publicando só os importantes no 3C OS (tag `email`), mais um bloco no Painel. Prompt pronto em `docs/`.
5. **Fonte `chloe` no banco** (hoje o que a Chloe cria sai como `manual`): migração no check de `source`, labels e filtros.
6. **Notícias traduzidas na coleta** (`title_pt`/`summary_pt`) quando houver `GROQ_API_KEY`.
7. **Chloe com IA de verdade:** quando o Cauã configurar a chave do Groq, comparar modelos abertos em português e no uso de ferramentas, e escolher o padrão.
8. Revisar com calma `components/home/home-bento.tsx`, `components/profile/profile-editor.tsx` e o grupo de vigias em `components/tasks/task-board.tsx`.

## Pendências que só o Cauã pode fazer

- Criar a chave grátis do Groq e colocá-la na Vercel como `GROQ_API_KEY`.
- Rodar `npm run telegram:setup` com o token do @BotFather.
- Ativar o push em Conexões no iPhone.
- Criar a tarefa agendada do vigia de preços no Claude (`docs/vigia-precos.md`).
- Reenviar os zips das skills (`docs/claude-skill/`, `docs/chatgpt-skill/`).

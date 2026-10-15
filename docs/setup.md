# Setup passo a passo

Tudo aqui cabe nos planos gratuitos: **Supabase Free** e **Vercel Hobby**. Nenhum passo pede cartão.

## 0. Pré-requisitos

- Node.js 20 ou superior
- Contas gratuitas no [GitHub](https://github.com), [Supabase](https://supabase.com) e [Vercel](https://vercel.com) (dá para entrar na Vercel e no Supabase com o próprio GitHub)
- GitHub CLI: `winget install GitHub.cli` (Windows) ou `brew install gh` (macOS)

```bash
git clone https://github.com/<seu-usuario>/central-3c.git
cd central-3c
npm install
```

## 1. Supabase

1. Em [supabase.com/dashboard](https://supabase.com/dashboard), clique em **New project**.
2. Nome: `central-3c`. Região: **South America (São Paulo)**. Crie uma senha do banco forte (guarde num gerenciador de senhas; o app não precisa dela). Plano **Free**.
3. Quando o projeto terminar de subir, copie o **Reference ID** em *Project Settings → General* (20 letras, também aparece na URL).
4. No terminal:

```bash
npx supabase login
npx supabase link --project-ref <REFERENCE_ID>
npx supabase db push
```

O `db push` cria as tabelas, índices de busca em português, RLS e a publicação do Realtime.

5. Pegue as chaves em *Project Settings → API Keys* (ou `npx supabase projects api-keys --project-ref <REFERENCE_ID>`):
   - `anon` / publishable → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / secret → `SUPABASE_SERVICE_ROLE_KEY` (**nunca** exponha no cliente)

## 2. Variáveis de ambiente

```bash
cp .env.example .env.local
npm run secrets   # gera API_KEY, MCP_SECRET e CRON_SECRET
```

Preencha o `.env.local`:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<REFERENCE_ID>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon/publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role/secret |
| `ALLOWED_EMAIL` | o único e-mail que pode entrar no painel |
| `API_KEY`, `MCP_SECRET`, `CRON_SECRET` | saída do `npm run secrets` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` localmente; a URL da Vercel em produção |

Depois rode o seed (libera seu e-mail, cria a sua conta de login e as áreas `perfil`, `preferencias` e `inbox`):

```bash
npm run db:seed
npm run dev
```

## 3. Deploy na Vercel

```bash
npx vercel login
npx vercel link            # cria o projeto central-3c
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
# repita para cada variável do .env.local (NEXT_PUBLIC_APP_URL = https://<seu-projeto>.vercel.app)
npx vercel deploy --prod
```

O `vercel.json` já registra o cron diário `/api/cron/keepalive`, que lê o banco e impede o Supabase Free de pausar por inatividade. A Vercel envia o `CRON_SECRET` automaticamente no header `Authorization`.

## 4. Auth do Supabase (URLs e e-mail)

Edite `supabase/config.toml` trocando `http://localhost:3000` pela URL de produção em `site_url` e adicionando `https://<seu-projeto>.vercel.app/auth/callback` em `additional_redirect_urls`. Depois:

```bash
npx supabase config push
```

Abra o link do e-mail no mesmo navegador em que pediu o acesso.

> **Código de 6 dígitos (opcional):** o plano Free só permite editar templates de e-mail com um SMTP próprio (ex.: Resend, gratuito). Com SMTP configurado em *Authentication → Emails → SMTP Settings*, descomente o bloco `[auth.email.template.magic_link]` do `config.toml` e rode `npx supabase config push`: o e-mail passa a trazer também o código, que o painel aceita. É o melhor caminho no PWA do iPhone, onde o link abre no Safari, fora do app.

> O cadastro de novos usuários já vem fechado (`enable_signup = false` em `[auth]` no `config.toml`, aplicado pelo `npx supabase config push`; o `[auth.email]` fica `true`, senão o login por e-mail para de funcionar), e o login não cria contas: só o e-mail do seed entra. Se você configurou o projeto antes disso, confira em *Authentication → Sign In / Providers* se **Allow new users to sign up** está desligado.

## 5. Claude (conector MCP)

1. Abra o painel → **Conexões** e copie a **URL do conector** (`https://<app>/api/mcp/<MCP_SECRET>`).
2. Em [claude.ai](https://claude.ai): **Configurações → Conectores → Adicionar conector personalizado**.
3. Nome `3C OS`, cole a URL e deixe as opções de OAuth em branco. Salve.
4. Numa conversa, ative o conector no menu de ferramentas. Ele fica disponível também no app do celular.
5. Cole o texto de `docs/claude-instrucoes.md` nas instruções dos seus Projetos e em **Configurações → Perfil → preferências**.

Teste: “salva o contexto da Axial: estamos migrando o front para Next 16”.

## 6. ChatGPT (GPT com Actions)

1. Em [chatgpt.com/gpts/editor](https://chatgpt.com/gpts/editor) → **Configurar**.
2. Nome `3C OS`. Em **Instruções**, cole `docs/gpt-instrucoes.md`.
3. **Criar nova ação → Importar de URL**: `https://<app>/api/v1/openapi.json`.
4. **Autenticação → Chave de API → Bearer** e cole a `API_KEY`.
5. **Política de privacidade**: `https://<app>/privacidade`.
6. Salve como **Somente eu**. O GPT aparece no app do celular na barra lateral.

Teste: “o que tem de novo na Axial?”.

> **Atenção:** a OpenAI vai desligar os GPTs personalizados em **11/12/2026** e as Actions não migram para plugins. Quando o seu plano liberar plugins com servidor MCP próprio, crie um plugin em **Plugins → + → Criar plugin** apontando para a **URL do conector MCP** (a mesma do Claude, sem autenticação). O 3C OS identifica o ChatGPT pelo user-agent; se precisar, acrescente `?fonte=chatgpt` ao final da URL.

## 7. Testar o MCP com o Inspector

```bash
# interface web: escolha Streamable HTTP e cole a URL do conector
npx @modelcontextprotocol/inspector

# linha de comando
npx @modelcontextprotocol/inspector --cli http://localhost:3000/api/mcp/<MCP_SECRET> --transport http --method tools/list
npx @modelcontextprotocol/inspector --cli http://localhost:3000/api/mcp/<MCP_SECRET> --transport http --method tools/call --tool-name obter_briefing
```

## 8. Chloe com IA (opcional, grátis)

Sem chave, a Chloe já entende pedidos curtos (lembretes, eventos, tarefas, notas, agenda, vigia de preço) por regras. Com uma chave gratuita, ela passa a entender pedidos livres e usar as ferramentas do 3C OS.

1. Crie uma conta em [console.groq.com](https://console.groq.com) e gere uma API key (plano gratuito, sem cartão).
2. Adicione na Vercel: `npx vercel env add GROQ_API_KEY production` e faça um novo deploy.
3. Opcional, como reserva quando o Groq atingir o limite: `OPENROUTER_API_KEY` (modelos `:free`) ou `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (Workers AI). Os modelos podem ser trocados pelas variáveis `*_MODEL*` do `.env.example`.

Como ela decide: regras primeiro (instantâneo); só o que as regras não entendem vai para o modelo rápido, e pedidos longos ou de planejamento vão para o modelo maior. Detalhes em `docs/chloe-arquitetura.md`.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| Login volta para `/login?erro=link` | Link aberto em outro navegador ou expirado. Use o código de 6 dígitos. |
| “Este e-mail não tem acesso” | `ALLOWED_EMAIL` diferente do e-mail digitado, ou seed não rodou. |
| Conector do Claude responde 404 | `MCP_SECRET` da URL diferente do configurado na Vercel. |
| GPT responde 401 | API key errada na ação ou falta o tipo Bearer. |
| Feed não atualiza sozinho | Migration não rodou a linha do `supabase_realtime`; rode `npx supabase db push`. |

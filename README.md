<div align="center">

# Central 3C

**A memória compartilhada entre Claude e ChatGPT.**
Projetos, trabalho, faculdade e decisões num só lugar, lido e gravado pelas duas IAs na hora.

[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)
[![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-7c3aed)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Custo](https://img.shields.io/badge/custo-R%24%200-success)](#stack)

![Início da Central 3C](docs/prints/inicio.png)

</div>

## O problema

Uso Claude e ChatGPT todo dia, e cada um vivia com metade do contexto. A tentativa anterior era uma pasta no Google Drive:

- o conector do Drive no Claude não edita documentos existentes, então tudo virava um "handoff" manual;
- uma tarefa agendada de madrugada tentava resumir o dia, mas rodava num chat novo, sem ver as conversas do dia, e concluía que "não havia nada para atualizar".

## A solução

Um app próprio que é a **fonte única de contexto**. Cada IA lê e grava direto nele, no momento em que algo acontece:

- **Claude** conecta por um **servidor MCP remoto** (conector personalizado no claude.ai, web e app).
- **ChatGPT** conecta por um **GPT personalizado com Actions** (OpenAPI), que lê e grava inclusive no app do celular.
- **Painel web** responsivo e instalável (PWA) para eu ver e editar tudo, com o feed atualizando ao vivo quando uma IA grava.

Cada **área** (projeto, trabalho, disciplina, curso) tem um **resumo vivo**, o documento canônico sempre atualizado, e uma **linha do tempo de registros** com decisões, progresso e contexto. Toda escrita guarda a versão anterior, então qualquer edição de IA pode ser desfeita.

## Arquitetura

```mermaid
flowchart LR
  claude["Claude<br/>(conector MCP)"] -->|"Streamable HTTP<br/>/api/mcp/[secret]"| mcp[Servidor MCP]
  gpt["ChatGPT<br/>(GPT + Actions)"] -->|"REST + Bearer<br/>/api/v1/*"| api[API REST]
  painel["Painel PWA"] -->|Server Actions| actions[Server Actions]

  mcp --> service
  api --> service
  actions --> service

  subgraph core["lib/central"]
    service["CentralService<br/>regras de negócio"] --> repo[Repository]
  end

  repo --> db[("Supabase Postgres<br/>RLS + busca full-text pt")]
  db -. Realtime .-> painel
```

- **Uma camada de serviço** (`lib/central`) concentra toda a regra: slugs, criação automática de área, versões, truncamento e briefing. MCP, REST e painel só chamam essa camada.
- **Uma tabela de operações** (`lib/central/operations.ts`) define cada operação uma vez: nome da ferramenta MCP, `operationId`, rota REST, schema Zod e descrição. O servidor MCP, o roteador REST e o `openapi.json` são gerados dela.
- **Repository** abstrai a persistência: Supabase em produção e uma implementação em memória nos testes.
- **Tempo real**: o painel assina o Supabase Realtime. Quando Claude ou ChatGPT gravam, o registro entra no feed e um "sinal" percorre a tela até ele.

## Funcionalidades

| | |
| --- | --- |
| **Início** | briefing do que mudou desde a última visita, contadores animados, áreas ativas e feed ao vivo com filtro por fonte e área |
| **Cérebro** | grafo de força interativo (canvas): áreas, registros e ligações por tags; nós brilham com a atividade e partículas correm quando há escrita nova |
| **Área** | resumo vivo editável em markdown com preview, linha do tempo, status, fixar e arquivar |
| **Busca** | full-text em português (`websearch_to_tsquery`), filtros por área e tipo; `Ctrl/Cmd + K` ou `/` abrem a paleta de comandos |
| **Histórico** | todas as versões de um resumo ou registro, com restauração reversível |
| **Conexões** | URL do conector MCP, URL do OpenAPI, API key mascarada e instruções prontas para colar |
| **Dados** | exportação em JSON e em Markdown (.zip), importação de `.md` ou texto colado |
| **PWA** | instalável no Android e iOS, login por código de 6 dígitos para funcionar dentro do app |

![Cérebro](docs/prints/cerebro.png)

<p align="center">
  <img src="docs/prints/mobile.png" alt="Painel no celular" width="280" />
</p>

## Ferramentas para as IAs

| MCP (Claude) | REST (ChatGPT) | O que faz |
| --- | --- | --- |
| `obter_briefing` | `GET /briefing` | perfil, preferências, áreas ativas e registros recentes |
| `listar_areas` | `GET /areas` | lista áreas com filtro por status e tipo |
| `ler_area` | `GET /areas/{slug}` | resumo vivo + últimos registros |
| `ler_registro` | `GET /entries/{id}` | conteúdo completo de um registro |
| `buscar` | `GET /search` | busca full-text com filtros de área, tipo e período |
| `salvar_registro` | `POST /entries` | cria registro (e a área, se não existir) |
| `atualizar_resumo` | `PUT /areas/{slug}/summary` | substitui o resumo vivo guardando a versão anterior |
| `editar_registro` | `PATCH /entries/{id}` | edita ou arquiva um registro |

As leituras são enxutas de propósito: conteúdo longo vem truncado com `truncado: true` e listas são paginadas, porque as IAs têm limite de tamanho de resposta.

## Stack

- **Next.js 16** (App Router, Cache Components, `proxy.ts`) + **TypeScript** estrito
- **Tailwind CSS 4**, **shadcn/ui** (Radix), **Motion**, **cmdk**, **react-force-graph-2d**
- **Supabase**: Postgres, Auth (magic link + OTP), Realtime, RLS, `tsvector` com dicionário `portuguese`
- **MCP**: `mcp-handler` 2 + `@modelcontextprotocol/server` (SDK v2), Streamable HTTP stateless
- **Zod 4**: um schema por operação, reaproveitado por MCP, REST, OpenAPI (`z.toJSONSchema`) e painel
- **Vitest** para serviço, autenticação, API e MCP
- **Vercel Hobby** + **Supabase Free**: custo zero, com cron diário para o Supabase não pausar

## Rodando localmente

```bash
npm install
cp .env.example .env.local
npm run secrets        # gera API_KEY, MCP_SECRET e CRON_SECRET
npx supabase link --project-ref <ref> && npx supabase db push
npm run db:seed
npm run dev
```

O passo a passo completo, incluindo deploy e a conexão no claude.ai e no ChatGPT, está em [docs/setup.md](docs/setup.md).

```bash
npm test               # Vitest
npm run lint
npm run build
npx @modelcontextprotocol/inspector --cli http://localhost:3000/api/mcp/<MCP_SECRET> --transport http --method tools/list
```

## Decisões técnicas

- **Segredo no caminho do MCP** (`/api/mcp/[secret]`, comparado em tempo constante): é o jeito mais simples de autenticar um conector pessoal no claude.ai sem OAuth. A rota já passa um `AuthInfo` adiante, então trocar por OAuth na v2 é substituir essa checagem pelo `withMcpAuth` do `mcp-handler`.
- **GPT com Actions em vez de conector MCP no ChatGPT**: no plano Plus, conectores MCP personalizados não gravam e não funcionam no celular.
- **SDK MCP v2** (`@modelcontextprotocol/server`): é a linha estável atual e a exigida pelo `mcp-handler` 2. Serve a spec 2026-07-28 e cai para Streamable HTTP stateless em clientes mais antigos.
- **Versões gravadas pela camada de serviço**, não por trigger: ficam testáveis e registram a fonte correta (Claude, ChatGPT ou manual).
- **Ferramenta extra `ler_registro`**: como as leituras truncam conteúdo longo, a IA precisa de um caminho para o texto completo.
- **Multiusuário no futuro**: o acesso passa pela tabela `members` e por RLS, e o serviço recebe o repositório por injeção. Virar multiusuário é adicionar `owner_id` e trocar o segredo por OAuth.
- **Rate limit em memória** por IP: suficiente para uso pessoal; cada instância serverless mantém o próprio contador.
- **Login por código além do link**: no iPhone, o link do e-mail abre no Safari, fora do PWA instalado; o código resolve.

## Estrutura

```
app/
  (app)/            páginas autenticadas do painel
  api/mcp/[secret]  servidor MCP
  api/v1/           API REST + openapi.json
  api/cron/         keepalive do Supabase
lib/central/        schemas, operações, serviço e repositórios
supabase/           migrations, config de auth e template de e-mail
docs/               setup, plano e instruções para as IAs
tests/              Vitest
```

## Licença

[MIT](LICENSE)

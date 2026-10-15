# Plano — 3C OS

## Versões conferidas (out/2026)

| Lib | Versão | Observação |
| --- | --- | --- |
| Next.js | 16.4 | `middleware` virou `proxy.ts`; `params` sempre assíncrono; `next lint` removido (usar `eslint`); `cacheComponents` ligado no template |
| MCP SDK | `@modelcontextprotocol/server` 2.x | v2 do SDK oficial (substitui `@modelcontextprotocol/sdk` 1.x); `registerTool` recebe `z.object` completo |
| mcp-handler | 2.3 | Handler `(Request) => Response`; serve a spec 2026-07-28 e cai para Streamable HTTP stateless em clientes 2025 |
| @supabase/ssr | 0.12 | `getAll`/`setAll`; `getClaims()` no proxy para renovar sessão |
| Zod | 4.x | `z.toJSONSchema()` nativo → gera o OpenAPI sem dependência extra |
| Vitest | 5.x | — |

## Arquitetura

```
claude.ai ──MCP──▶ /api/mcp/[secret] ─┐
ChatGPT ──REST──▶ /api/v1/*  ─────────┼──▶ lib/central (service) ──▶ Repository ──▶ Supabase Postgres
Painel ──Server Actions──────────────┘                                     ▲
Painel ◀──Realtime (RLS)───────────────────────────────────────────────────┘
```

- `lib/central/schemas.ts`: schemas Zod únicos (MCP, REST, OpenAPI e painel).
- `lib/central/service.ts`: regras (slug, auto-criação de área, versões, truncamento, briefing).
- `lib/central/repository.ts`: interface de persistência. Implementações: Supabase (produção) e memória (testes).
- Painel usa o cliente do usuário (RLS). API/MCP usam service role no servidor.
- Multiusuário no futuro: tabela `members` já controla quem acessa; basta adicionar `owner_id` e trocar o segredo por OAuth.

## Etapas

1. Base, migrations, seed, camada de serviço + testes
2. Servidor MCP + teste com Inspector
3. API REST + OpenAPI
4. Painel web + PWA + visual
5. Cron keepalive, import/export, docs, README
6. Deploy (Supabase CLI, Vercel CLI, GitHub)

## Decisões

- **SDK MCP v2** em vez de `@modelcontextprotocol/sdk` 1.x: é a linha estável atual e a exigida pelo `mcp-handler` 2.x.
- **Ferramenta extra `ler_registro`**: como as leituras truncam conteúdo longo, a IA precisa de um jeito de buscar o texto completo de um registro.
- **Versões gravadas pela camada de serviço**, não por trigger: fica testável e registra a `source` correta.
- **Rate limit em memória** (janela deslizante por chave+IP): suficiente para uso pessoal; cada instância serverless tem o próprio contador.
- **Acesso ao painel** por tabela `members` + RLS, preenchida pelo seed com `ALLOWED_EMAIL`.

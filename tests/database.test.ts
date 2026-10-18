import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { testDatabase } from "./db-fixture";
import { payloadHash } from "@/lib/work/hash";
let db: PGlite;
beforeAll(async () => {
  db = await testDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Migrações em PostgreSQL real isolado", () => {
  it("aplica schema com RLS em todas as tabelas novas e RPCs de fila só no servidor", async () => {
    const rows = await db.query<{ relname: string }>(
      "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    );
    expect(rows.rows).toEqual([]);
    const grants = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated','public.claim_work(text,uuid,uuid[],text,uuid,text[])','execute') allowed",
    );
    expect(grants.rows[0].allowed).toBe(false);
  });
  it("a edição é atômica e a versão antiga não sobrescreve", async () => {
    await db.exec(
      "insert into public.areas(slug,name) values('test','Test'); insert into public.entries(area_id,title) select id,'Antes' from public.areas where slug='test';",
    );
    const { rows } = await db.query<{ id: string }>(
      "select id from public.entries where title='Antes'",
    );
    await db.query(
      'select public.edit_entry_atomic($1,1,\'{"title":"Atual"}\')',
      [rows[0].id],
    );
    await expect(
      db.query(
        'select public.edit_entry_atomic($1,1,\'{"title":"Perdido"}\')',
        [rows[0].id],
      ),
    ).rejects.toThrow("Conflito");
    expect(
      (await db.query("select count(*)::int n from public.versions")).rows,
    ).toEqual([{ n: 1 }]);
  });
  it("reserva cota transacional e impede ultrapassar teto por concorrência", async () => {
    const results = await Promise.allSettled([
      db.query("select public.reserve_usage('groq','a',60000)"),
      db.query("select public.reserve_usage('groq','b',60000)"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("protege também os contratos SQL antigos e não aceita fonte informada como identidade", async () => {
    await db.exec(
      "insert into public.entries(area_id,title,content_md,ai_access) select id,'Privada','marcadorreservado','private' from public.areas where slug='test';",
    );
    const rows = await db.query<{ id: string }>(
      "select id from public.entries where title='Privada'",
    );
    const search = await db.query(
      "select * from public.search_entries('marcadorreservado')",
    );
    expect(search.rows).toHaveLength(0);
    await expect(
      db.query("select central.ler_registro($1)", [rows.rows[0].id]),
    ).rejects.toThrow();
    await db.query(
      "select central.salvar_registro(p_titulo=>'SQL identity',p_area=>'test',p_tipo=>'nota',p_conteudo=>'Teste SQL',p_fonte=>'grok')",
    );
    expect(
      (
        await db.query<{ source: string }>(
          "select source from public.entries where title='SQL identity'",
        )
      ).rows[0].source,
    ).toBe("system");
    expect(
      (
        await db.query<{ owned: boolean }>(
          "select owner_id is not null owned from public.entries where title='SQL identity'",
        )
      ).rows[0].owned,
    ).toBe(true);
  });
  it("cria tarefa e fila uma única vez e rejeita reuso de chave com outro pedido", async () => {
    await db.exec(
      "update public.execution_control set paused=false;update public.agents set active=true where handle='codex';",
    );
    const agent = (
      await db.query<{ id: string }>(
        "select id from public.agents where handle='codex'",
      )
    ).rows[0].id;
    const area = (
      await db.query<{ id: string }>(
        "select id from public.areas where slug='test'",
      )
    ).rows[0].id;
    const i = {
      area_id: area,
      assigned_agent_id: agent,
      source: "manual",
      owner_id: "00000000-0000-4000-8000-000000000001",
      workflow_key: "code_demo",
      workflow_version: 1,
      status: "queued",
      objective: "Demo isolada",
      expected_output: "HTML e teste",
      acceptance_criteria: "Jornada funcionando",
      allowed_actions: ["read", "prepare"],
      input_refs: [],
      depends_on: [],
      current_step: "prepare",
    };
    const first = await db.query(
      "select public.create_work_atomic('client','key-0001',$1,$2) id",
      [payloadHash(i), JSON.stringify(i)],
    );
    const again = await db.query(
      "select public.create_work_atomic('client','key-0001',$1,$2) id",
      [payloadHash(i), JSON.stringify(i)],
    );
    expect(first.rows).toEqual(again.rows);
    await expect(
      db.query(
        "select public.create_work_atomic('client','key-0001','different',$1)",
        [JSON.stringify(i)],
      ),
    ).rejects.toThrow("Idempotência");
    const claims = await Promise.all([
      db.query("select * from public.claim_work('executor-a',$1,$2,'codex')", [
        agent,
        [area],
      ]),
      db.query("select * from public.claim_work('executor-b',$1,$2,'codex')", [
        agent,
        [area],
      ]),
    ]);
    expect(claims.reduce((n, r) => n + r.rows.length, 0)).toBe(1);
  });
  it("recupera posse expirada e rejeita entrega antiga; entrega repetida é idempotente", async () => {
    const old = (
      await db.query<{
        id: string;
        entry_id: string;
        executor_client_id: string;
        lease_token: string;
        fencing_token: number;
      }>("select * from public.work_runs where status='running'")
    ).rows[0];
    await db.query(
      "update public.work_runs set lease_expires_at=now()-interval '1 minute' where id=$1",
      [old.id],
    );
    const result = {
      summary: "Resultado real de fixture; sem integração externa",
      evidence: [
        { url: "https://example.test/demo", title: "Evidência de teste" },
      ],
    };
    await expect(
      db.query("select public.report_work($1,$2,$3,$4,'delivered',$5)", [
        old.id,
        old.executor_client_id,
        old.lease_token,
        old.fencing_token,
        JSON.stringify(result),
      ]),
    ).rejects.toThrow("vencida");
    const w = (
      await db.query<{ assigned_agent_id: string; area_id: string }>(
        "select * from public.work_items where entry_id=$1",
        [old.entry_id],
      )
    ).rows[0];
    await db.query("select * from public.claim_work('new',$1,$2,'codex')", [
      w.assigned_agent_id,
      [w.area_id],
    ]);
    await db.query(
      "update public.work_items set available_at=now()-interval '1 minute' where entry_id=$1",
      [old.entry_id],
    );
    const claimed = (
      await db.query<{
        id: string;
        lease_token: string;
        fencing_token: number;
      }>("select * from public.claim_work('new',$1,$2,'codex')", [
        w.assigned_agent_id,
        [w.area_id],
      ])
    ).rows[0];
    expect(claimed.fencing_token).not.toBe(old.fencing_token);
    await expect(
      db.query("select public.report_work($1,$2,$3,$4,'delivered',$5)", [
        old.id,
        old.executor_client_id,
        old.lease_token,
        old.fencing_token,
        JSON.stringify(result),
      ]),
    ).rejects.toThrow("vencida");
    const params = [
      claimed.id,
      "new",
      claimed.lease_token,
      claimed.fencing_token,
      JSON.stringify(result),
    ];
    await db.query(
      "select public.report_work($1,$2,$3,$4,'delivered',$5)",
      params,
    );
    await db.query(
      "select public.report_work($1,$2,$3,$4,'delivered',$5)",
      params,
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.work_items where entry_id=$1",
          [old.entry_id],
        )
      ).rows[0].status,
    ).toBe("delivered");
  });
  it("amarra aprovação ao conteúdo/destino, pausa e uso único", async () => {
    const work = (
      await db.query<{ entry_id: string }>(
        "select entry_id from public.work_items limit 1",
      )
    ).rows[0].entry_id;
    const payload = {
      action: "social_post",
      account: "teste",
      target: "canal de teste",
      body: "conteúdo aprovado",
      attachments: [],
    };
    const hash = payloadHash(payload);
    const a = (
      await db.query<{ id: string }>(
        "insert into public.action_approvals(entry_id,action_type,target,payload_hash,payload_ref,requested_by,status,approved_by) values($1,'social_post','canal de teste',$2,$3,'fixture','approved','00000000-0000-4000-8000-000000000001') returning id",
        [work, hash, JSON.stringify(payload)],
      )
    ).rows[0].id;
    await expect(
      db.query("select public.consume_approval($1,$2)", [
        a,
        payloadHash({ ...payload, target: "outro destino" }),
      ]),
    ).rejects.toThrow("inválida");
    await db.exec("update public.execution_control set paused=true");
    await expect(
      db.query("select public.consume_approval($1,$2)", [a, hash]),
    ).rejects.toThrow("pausada");
    await db.exec("update public.execution_control set paused=false");
    await db.query("select public.consume_approval($1,$2)", [a, hash]);
    await expect(
      db.query("select public.consume_approval($1,$2)", [a, hash]),
    ).rejects.toThrow("inválida");
  });
  it("importa CSV uma vez e mantém despesas coincidentes legítimas; RLS nega outro proprietário", async () => {
    await db.exec(
      "select set_config('request.jwt.claim.email','owner@example.test',false);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);",
    );
    const rows = [
      {
        date: "2026-10-18",
        description: "Café",
        category: "Alimentação",
        direction: "saida",
        amount: "12.50",
      },
      {
        date: "2026-10-18",
        description: "Café",
        category: "Alimentação",
        direction: "saida",
        amount: "12.50",
      },
    ];
    const hash = "a".repeat(64);
    await db.exec("set role authenticated");
    await db.query(
      "select public.commit_finance_import('00000000-0000-4000-8000-000000000001',$1,'Pessoal',$2)",
      [hash, JSON.stringify(rows)],
    );
    await db.query(
      "select public.commit_finance_import('00000000-0000-4000-8000-000000000001',$1,'Pessoal',$2)",
      [hash, JSON.stringify(rows)],
    );
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.personal_transactions",
        )
      ).rows[0].n,
    ).toBe(2);
    await db.exec(
      "select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false)",
    );
    expect(
      (await db.query("select * from public.personal_transactions")).rows,
    ).toHaveLength(0);
    await db.exec("reset role");
  });
});

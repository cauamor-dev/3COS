import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { testDatabase } from "./db-fixture";
let db: PGlite;
const owner = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = await testDatabase();
  await db.exec(
    "insert into public.areas(slug,name) values('notify-test','Teste');",
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Time v2 e avisos privados em PostgreSQL", () => {
  it("preserva aliases e bloqueia cliente Grok diferente da Clara no banco", async () => {
    expect(
      (
        await db.query(
          "select handle from public.agents where platform='grok' and external_active order by handle",
        )
      ).rows,
    ).toEqual([
      { handle: "atlas" },
      { handle: "clara" },
      { handle: "rastro" },
      { handle: "tereza" },
    ]);
    expect(
      (
        await db.query(
          "select legacy_handles from public.agents where handle='clara'",
        )
      ).rows,
    ).toEqual([{ legacy_handles: ["norte"] }]);
    await expect(
      db.query(
        "insert into public.integration_clients(name,token_hash,token_prefix,owner_id,agent_id,source,expires_at) select 'Teste','hash','prefix',$1,id,'grok',now()+interval '1 day' from public.agents where handle='rastro'",
        [owner],
      ),
    ).rejects.toThrow("Somente Clara");
  });
  it("Tereza é dona do trabalho e apenas Clara adquire a posse", async () => {
    await db.exec(
      "update public.agents set active=true where handle in('clara','tereza');update public.execution_control set paused=false;",
    );
    const ids = (
      await db.query<{ handle: string; id: string }>(
        "select handle,id from public.agents where handle in('clara','tereza')",
      )
    ).rows;
    const t = ids.find((a) => a.handle === "tereza")!.id,
      c = ids.find((a) => a.handle === "clara")!.id;
    const area = (
      await db.query<{ id: string }>(
        "select id from public.areas where slug='notify-test'",
      )
    ).rows[0].id;
    const e = (
      await db.query<{ id: string }>(
        "insert into public.entries(area_id,title,owner_id) values($1,'QA',$2) returning id",
        [area, owner],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.work_items(entry_id,area_id,workflow_key,assigned_agent_id,objective,expected_output,acceptance_criteria,idempotency_key,created_by) values($1,$2,'code_demo',$3,'QA','Teste real','Evidência','qa-v2','fixture')",
      [e, area, t],
    );
    expect(
      (
        await db.query<{ bridge_agent_id: string }>(
          "select bridge_agent_id from public.work_items where entry_id=$1",
          [e],
        )
      ).rows[0].bridge_agent_id,
    ).toBe(c);
    expect(
      (
        await db.query(
          "select * from public.claim_work('wrong',$1,$2,'grok')",
          [t, [area]],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select * from public.claim_work('bridge',$1,$2,'grok')",
          [c, [area]],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("gera lembrete privado uma vez e avança recorrência diária em Brasília", async () => {
    await db.query(
      "insert into public.entries(area_id,title,owner_id,ai_access,remind_at,recurrence) select id,'Conteúdo privado',$1,'private','2026-10-18 12:00:00-03','diaria' from public.areas where slug='notify-test'",
      [owner],
    );
    await db.query(
      "select public.collect_notifications('2026-10-18 12:05:00-03')",
    );
    await db.query(
      "select public.collect_notifications('2026-10-18 12:05:00-03')",
    );
    expect(
      (
        await db.query(
          "select count(*)::int n from public.notifications where kind='reminder'",
        )
      ).rows,
    ).toEqual([{ n: 1 }]);
    expect(
      (
        await db.query<{ next: string }>(
          "select remind_at::text as next from public.entries where title='Conteúdo privado'",
        )
      ).rows[0].next,
    ).toContain("2026-10-19 12:00:00-03");
  });
  it("respeita silêncio, posse única e não repete transporte incerto", async () => {
    await db.query(
      "update public.notification_preferences set push=true where owner_id=$1",
      [owner],
    );
    await db.query(
      "update public.notifications set created_at='2026-10-18 23:00:00-03'",
    );
    expect(
      (
        await db.query(
          "select * from public.claim_notification_push('2026-10-18 23:00:00-03')",
        )
      ).rows,
    ).toHaveLength(0);
    const claims = await Promise.all([
      db.query(
        "select * from public.claim_notification_push('2026-10-19 08:00:00-03')",
      ),
      db.query(
        "select * from public.claim_notification_push('2026-10-19 08:00:00-03')",
      ),
    ]);
    expect(claims.flatMap((r) => r.rows)).toHaveLength(1);
    await db.query(
      "select * from public.claim_notification_push('2026-10-19 08:03:00-03')",
    );
    expect(
      (await db.query("select push_status from public.notifications")).rows,
    ).toEqual([{ push_status: "uncertain" }]);
  });
  it("RLS impede outro proprietário e cliente autenticado não altera texto do aviso", async () => {
    await db.exec(
      "set role authenticated;select set_config('request.jwt.claim.email','owner@example.test',false);select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);",
    );
    expect(
      (await db.query("select id from public.notifications")).rows,
    ).toHaveLength(0);
    await db.exec(
      "select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);",
    );
    expect(
      (await db.query("select id from public.notifications")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec("update public.notifications set body='forjado'"),
    ).rejects.toThrow("permission denied");
    await db.exec("update public.notifications set read_at=now();reset role;");
    expect(
      (
        await db.query(
          "select has_function_privilege('authenticated','public.claim_notification_push(timestamptz)','execute') allowed",
        )
      ).rows,
    ).toEqual([{ allowed: false }]);
  });
  it("seleção de aprovações é atômica e rejeita uma peça alterada", async () => {
    const e = (
      await db.query<{ entry_id: string }>(
        "select entry_id from public.work_items limit 1",
      )
    ).rows[0].entry_id;
    const items = (
      await db.query<{ id: string; payload_hash: string }>(
        "insert into public.action_approvals(entry_id,action_type,target,payload_hash,payload_ref,requested_by) values($1,'message','destino-a',repeat('a',64),'{}','fixture'),($1,'message','destino-b',repeat('b',64),'{}','fixture') returning id,payload_hash",
        [e],
      )
    ).rows;
    await expect(
      db.query("select public.decide_approvals_batch($1,$2,true)", [
        owner,
        JSON.stringify([
          items[0],
          { ...items[1], payload_hash: "c".repeat(64) },
        ]),
      ]),
    ).rejects.toThrow("alterada");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.action_approvals",
        )
      ).rows.every((a) => a.status === "pending"),
    ).toBe(true);
    await db.query("select public.decide_approvals_batch($1,$2,true)", [
      owner,
      JSON.stringify(items),
    ]);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.action_approvals",
        )
      ).rows.every((a) => a.status === "approved"),
    ).toBe(true);
    await expect(
      db.query(
        "select public.consume_approval_with_lease($1,$2,gen_random_uuid(),'wrong',gen_random_uuid(),1)",
        [items[0].id, items[0].payload_hash],
      ),
    ).rejects.toThrow("Posse");
  });
  it("o worker service_role consegue produzir avisos sem conceder schema às IAs", async () => {
    await db.exec("set role service_role");
    await db.query("select public.collect_notifications()");
    await db.exec("reset role");
    expect(
      (
        await db.query(
          "select has_schema_privilege('authenticated','central','usage') allowed",
        )
      ).rows,
    ).toEqual([{ allowed: false }]);
  });
});

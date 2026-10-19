import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TeamService } from "@/lib/team/service";
import { CentralService } from "@/lib/central/service";
import { MemoryRepository } from "@/lib/central/memory-repository";
import type { ActorContext } from "@/lib/central/access";

async function fixture() {
  const repo = new MemoryRepository();
  const human: ActorContext = {
    kind: "human",
    id: "owner",
    userId: "00000000-0000-4000-8000-000000000001",
    source: "manual",
  };
  const owner = new CentralService(repo).asActor(human);
  const area = await owner.createArea({ nome: "Projeto" }, "manual");
  const other = await owner.createArea({ nome: "Outro" }, "manual");
  const { registro } = await owner.saveEntry(
    { area_slug: area.slug, titulo: "Trabalho", ai_access: "shared" },
    "manual",
  );
  const ai: ActorContext = {
    kind: "integration",
    id: "clara",
    source: "grok",
    grants: [{ areaId: area.id, operations: ["read", "team"] }],
  };
  let inserted: Record<string, unknown> | undefined;
  const rows = [
    {
      id: "00000000-0000-4000-8000-000000000010",
      entry_id: registro.id,
      area_id: area.id,
      visibility: "shared",
      title: "Contexto do trabalho",
    },
  ];
  const query = {
    select: () => query,
    order: () => query,
    eq: () => query,
    in: () => query,
    or: () => query,
    limit: async () => ({ data: rows, error: null }),
    insert: (row: Record<string, unknown>) => {
      inserted = row;
      return query;
    },
    single: async () => ({ data: inserted, error: null }),
  };
  const db = { from: () => query } as unknown as SupabaseClient;
  return {
    owner,
    repo,
    area,
    other,
    registro,
    ai,
    service: (actor: ActorContext) =>
      new TeamService(db, actor, owner.asActor(actor)),
    human,
    inserted: () => inserted,
  };
}
describe("Conversas acompanham a privacidade do registro", () => {
  it("retira a conversa da IA quando o registro se torna privado e nega ler mensagens", async () => {
    const f = await fixture();
    expect(await f.service(f.ai).threads()).toHaveLength(1);
    await f.owner.editEntry(
      { id: f.registro.id, revision: 1, ai_access: "private" },
      "manual",
    );
    expect(await f.service(f.ai).threads()).toHaveLength(0);
    await expect(
      f
        .service(f.ai)
        .messages({ thread_id: "00000000-0000-4000-8000-000000000010" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await f.service(f.human).threads()).toHaveLength(1);
  });
  it("cria conversa pessoal para registro privado, sem compartilhá-la por padrão", async () => {
    const f = await fixture();
    await f.owner.editEntry(
      { id: f.registro.id, revision: 1, ai_access: "private" },
      "manual",
    );
    await f
      .service(f.human)
      .createThread({
        title: "Revisão privada",
        area_slug: f.area.slug,
        entry_id: f.registro.id,
      });
    expect(f.inserted()).toMatchObject({
      visibility: "personal",
      owner_id: f.human.userId,
    });
  });
  it("impede associar uma conversa ao trabalho de outra área", async () => {
    const f = await fixture();
    await expect(
      f
        .service(f.human)
        .createThread({
          title: "Área errada",
          area_slug: f.other.slug,
          entry_id: f.registro.id,
        }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(f.inserted()).toBeUndefined();
  });
});

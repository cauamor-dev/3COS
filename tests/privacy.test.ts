import { describe, expect, it } from "vitest";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService } from "@/lib/central/service";
import {
  CHLOE_ACTOR,
  SENSITIVE_ENTRY_IDS,
  type ActorContext,
} from "@/lib/central/access";

describe("Autorização inclusive no serviço administrativo", () => {
  it("filtra antes de busca, contagem, exportação, histórico, agenda e detalhes", async () => {
    const repo = new MemoryRepository();
    const owner = new CentralService(repo);
    const { registro } = await owner.saveEntry(
      {
        titulo: "reservado",
        conteudo: "segredo sanitizado",
        ai_access: "private",
        tipo: "tarefa",
        prazo: "2026-10-20",
      },
      "manual",
    );
    const ai = owner.asActor(CHLOE_ACTOR);
    expect((await ai.search({ consulta: "segredo" })).total).toBe(0);
    expect((await ai.exportAll()).entries).toHaveLength(0);
    expect((await ai.listTasks()).total).toBe(0);
    expect(await ai.versions("entries", registro.id)).toEqual([]);
    await expect(ai.getEntry(registro.id)).rejects.toMatchObject({
      code: "not_found",
    });
    repo.entries[0].id = SENSITIVE_ENTRY_IDS[0];
    repo.entries[0].ai_access = "shared";
    expect((await ai.feed()).total).toBe(0);
  });
  it("nega por padrão e não aceita autoria ou movimento de área forjado", async () => {
    const owner = new CentralService(new MemoryRepository());
    const a = await owner.createArea({ nome: "Axial" }, "manual");
    await owner.createArea({ nome: "Pessoal" }, "manual");
    const actor: ActorContext = {
      kind: "integration",
      id: "lume",
      source: "grok",
      grants: [{ areaId: a.id, operations: ["read", "write"] }],
    };
    const ai = owner.asActor(actor);
    const { registro } = await ai.saveEntry(
      { area_slug: "axial", titulo: "Peça" },
      "claude",
    );
    expect(registro.fonte).toBe("grok");
    await expect(
      ai.editEntry({ id: registro.id, area_slug: "pessoal" }, "manual"),
    ).rejects.toBeTruthy();
    await expect(
      ai.editEntry({ id: registro.id, ai_access: "private",revision:1 }, "manual"),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(
      (await owner.asActor({ ...actor, grants: [] }).listAreas()).total,
    ).toBe(0);
  });
  it("rejeita revisão antiga sem criar histórico falso", async () => {
    const repo = new MemoryRepository();
    const central = new CentralService(repo);
    const { registro } = await central.saveEntry({ titulo: "Antes" }, "manual");
    await central.editEntry(
      { id: registro.id, titulo: "Atual", revision: 1 },
      "manual",
    );
    await expect(
      central.editEntry(
        { id: registro.id, titulo: "Perdido", revision: 1 },
        "manual",
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    expect((await central.getEntry(registro.id)).title).toBe("Atual");
    expect(repo.versions).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { CentralService } from "@/lib/central/service";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CHLOE_ACTOR } from "@/lib/central/access";
import { savePrivateNote } from "@/lib/central/private-notes";

describe("Área segura", () => {
  it("força privacidade e preserva o texto, mesmo com entrada manipulada", async () => {
    const central = new CentralService(new MemoryRepository()).asActor({
      kind: "human",
      id: "owner",
      userId: "owner",
      source: "manual",
    });
    const content = "  Informação sintética\ncom espaços preservados.  ";
    const result = await savePrivateNote(central, {
      title: "Teste sintético",
      content,
      ai_access: "shared",
      area_slug: "inbox",
    });
    const entry = await central.getEntry(result.registro.id);
    expect(entry.ai_access).toBe("private");
    expect(entry.content_md).toBe(content);
    await expect(
      central.asActor(CHLOE_ACTOR).getEntry(entry.id),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(
      (await central.asActor(CHLOE_ACTOR).search({ consulta: "sintética" }))
        .total,
    ).toBe(0);
  });
  it("recusa atores de IA e humano sem proprietário", async () => {
    const central = new CentralService(new MemoryRepository());
    for (const actor of [
      CHLOE_ACTOR,
      { kind: "human" as const, id: "unowned", source: "manual" as const },
    ]) {
      await expect(
        savePrivateNote(central.asActor(actor), {
          title: "Teste",
          content: "Sintético",
        }),
      ).rejects.toThrow("Proprietário autenticado");
    }
  });
});

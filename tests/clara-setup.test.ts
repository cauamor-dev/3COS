import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claraFixtures, claraTestPrompt } from "@/lib/integrations/clara-setup";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService } from "@/lib/central/service";
import { TeamService } from "@/lib/team/service";
describe("Preparação da Clara", () => {
  it("prepara fixtures uma vez e o prompt não entrega os marcadores", async () => {
    const repo = new MemoryRepository(),
      owner = new CentralService(repo).asActor({
        kind: "human",
        id: "owner",
        userId: "00000000-0000-4000-8000-000000000001",
        source: "manual",
      });
    const filters: Record<string, unknown> = {};
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => {
        filters[k] = v;
        return q;
      },
      maybeSingle: async () => ({
        data:
          repo.entries.find(
            (e) =>
              e.external_id === filters.external_id &&
              e.owner_id === filters.owner_id,
          ) ?? null,
        error: null,
      }),
    };
    const db = { from: () => q } as unknown as SupabaseClient;
    const fixture = await claraFixtures(db, owner);
    expect(await claraFixtures(db, owner)).toEqual(fixture);
    expect(repo.entries).toHaveLength(2);
    const prompt = claraTestPrompt(fixture);
    for (const e of repo.entries)
      expect(prompt).not.toContain(e.content_md.split(": ").at(-1));
    const area = await owner.getArea("validacao-3c");
    const ai = owner.asActor({
      kind: "integration",
      id: "clara",
      source: "grok",
      grants: [{ areaId: area.id, operations: ["read", "write", "team"] }],
    });
    await expect(ai.getEntry(fixture.sharedId)).resolves.toBeTruthy();
    await expect(ai.getEntry(fixture.privateId)).rejects.toMatchObject({
      code: "not_found",
    });
  });
  it("diagnóstico não simula produto nativo nem mostra áreas não concedidas", async () => {
    const owner = new CentralService(new MemoryRepository());
    const a = await owner.createArea({ nome: "Permitida" }, "manual");
    await owner.createArea({ nome: "Pessoal" }, "manual");
    const actor = {
      kind: "integration" as const,
      id: "client",
      source: "grok" as const,
      agentId: "agent",
      grants: [
        { areaId: a.id, operations: ["read" as const, "team" as const] },
      ],
    };
    let table = "";
    const q = {
      select: () => q,
      eq: () => q,
      single: async () => ({
        data:
          table === "agents"
            ? { handle: "clara", name: "Clara" }
            : { paused: true },
        error: null,
      }),
    };
    const db = {
      from: (t: string) => {
        table = t;
        return q;
      },
    } as unknown as SupabaseClient;
    const result = await new TeamService(
      db,
      actor,
      owner.asActor(actor),
    ).diagnostic();
    expect(result.agent.handle).toBe("clara");
    expect(result.areas.map((a) => a.slug)).toEqual(["permitida"]);
    expect(result.native_platform_proven).toBe(false);
    expect(result.paused).toBe(true);
  });
});

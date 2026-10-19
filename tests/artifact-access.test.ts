import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService } from "@/lib/central/service";
import { CHLOE_ACTOR, type ActorContext } from "@/lib/central/access";

type File = {
  id: string;
  owner_id: string | null;
  entry_id: string | null;
  area_id: string | null;
  visibility: string;
  status: string;
  object_path: string;
};
const state: { repo: MemoryRepository; file: File | null } = {
  repo: new MemoryRepository(),
  file: null,
};
const createSignedUrl = vi.fn(async (path: string) => ({
  data: { signedUrl: `https://bucket/${path}` },
  error: null,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.file, error: null }),
        }),
      }),
    }),
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));
vi.mock("@/lib/central/server", () => ({
  adminCentral: (actor: ActorContext) =>
    new CentralService(state.repo).asActor(actor),
}));
const { ArtifactService } = await import("@/lib/files/artifacts");

const OWNER: ActorContext = {
  kind: "human",
  id: "owner",
  userId: "owner",
  source: "manual",
};
const FILE_ID = "6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d";

async function setup(aiAccess: "shared" | "private", visibility: string) {
  state.repo = new MemoryRepository();
  const owner = new CentralService(state.repo).asActor(OWNER);
  const { registro } = await owner.saveEntry(
    { area_slug: "validacao-3c", titulo: "Sintético", ai_access: aiAccess },
    "manual",
  );
  const entry = await owner.getEntry(registro.id);
  state.file = {
    id: FILE_ID,
    owner_id: "owner",
    entry_id: entry.id,
    area_id: entry.area_id,
    visibility,
    status: "ready",
    object_path: "arquivos/teste.pdf",
  };
  const agent: ActorContext = {
    kind: "integration",
    id: "client-cursor",
    source: "cursor",
    grants: [{ areaId: entry.area_id, operations: ["read", "files"] }],
  };
  return { agent };
}

beforeEach(() => createSignedUrl.mockClear());

describe("Acesso a anexos pelas IAs", () => {
  it("entrega link do arquivo compartilhado à conexão com concessão", async () => {
    const { agent } = await setup("shared", "shared");
    await expect(new ArtifactService(agent).download(FILE_ID)).resolves.toMatch(
      /^https:\/\/bucket\//,
    );
  });

  it("recusa anexo privado à conexão e à Chloe, mas abre para o proprietário", async () => {
    const { agent } = await setup("private", "private");
    for (const actor of [agent, CHLOE_ACTOR])
      await expect(
        new ArtifactService(actor).download(FILE_ID),
      ).rejects.toMatchObject({ code: "forbidden" });
    await expect(new ArtifactService(OWNER).download(FILE_ID)).resolves.toBeTruthy();
  });

  it("recusa quando a visibilidade do arquivo ficou desatualizada e o registro é privado", async () => {
    const { agent } = await setup("private", "shared");
    for (const actor of [agent, CHLOE_ACTOR])
      await expect(
        new ArtifactService(actor).download(FILE_ID),
      ).rejects.toMatchObject({ code: "not_found" });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("recusa conexão sem concessão de arquivos na área", async () => {
    const { agent } = await setup("shared", "shared");
    const readOnly = {
      ...agent,
      grants: agent.grants!.map((g) => ({ ...g, operations: ["read" as const] })),
    };
    await expect(
      new ArtifactService(readOnly).download(FILE_ID),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});

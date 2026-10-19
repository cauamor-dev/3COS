import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService } from "@/lib/central/service";
const mocks = vi.hoisted(() => ({ member: vi.fn(), run: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getMember: mocks.member }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/chloe/agent", () => ({ runChloe: mocks.run }));
vi.mock("@/lib/chloe/llm", async (original) => ({
  ...(await original<typeof import("@/lib/chloe/llm")>()),
  chloeAvailable: () => true,
}));
import { chloeCommandAction } from "@/app/(app)/chloe-actions";
import { ChloeProviderError } from "@/lib/chloe/llm";

describe("Perguntar continua sem escrita", () => {
  let central: CentralService;
  beforeEach(() => {
    vi.clearAllMocks();
    central = new CentralService(new MemoryRepository());
    mocks.member.mockResolvedValue({ central });
  });
  it("recusa anexo sem salvar um registro nem chamar o modelo", async () => {
    const result = await chloeCommandAction(
      "Leia este arquivo",
      {
        links: [
          { url: "https://example.com/ficticio.pdf", titulo: "Fictício" },
        ],
      },
      { mode: "perguntar" },
    );
    expect(result).toMatchObject({ ok: false });
    expect(mocks.run).not.toHaveBeenCalled();
    expect((await central.feed()).total).toBe(0);
  });
  it("mantém busca por palavras e informa a cota sem tentar outro provedor", async () => {
    mocks.run.mockRejectedValue(new ChloeProviderError("quota"));
    const result = await chloeCommandAction(
      "Qual banco de dados escolhemos?",
      undefined,
      { mode: "perguntar" },
    );
    expect(result).toMatchObject({
      ok: true,
      data: { status: expect.stringContaining("Limite gratuito") },
    });
    expect(mocks.run).toHaveBeenCalledOnce();
    expect(mocks.run.mock.calls[0][1]).toMatchObject({ readOnly: true });
    expect((await central.feed()).total).toBe(0);
  });
});

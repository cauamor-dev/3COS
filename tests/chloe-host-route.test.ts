import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  run: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@/lib/http/cron", () => ({ isCronRequest: mocks.auth }));
vi.mock("@/lib/chloe/host-evaluation", () => ({ hostEvaluation: mocks.run }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { POST } from "@/app/api/internal/chloe-evaluation/route";
const req = (body: object) =>
  new Request("https://example.com/api/internal/chloe-evaluation", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue(true);
  vi.stubEnv("GROQ_API_KEY", "fixture");
  vi.stubEnv("CHLOE_FREE_TIER_CONFIRMED", "0");
});
afterEach(() => vi.unstubAllEnvs());
describe("Avaliação interna protegida", () => {
  it("não aceita pedido anônimo nem usa banco ou modelo", async () => {
    mocks.auth.mockReturnValue(false);
    expect(
      (await POST(req({ action: "evaluate", case_id: "E01" }))).status,
    ).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("recusa inferência sem Free confirmado, mas permite consultar status", async () => {
    expect(
      (await POST(req({ action: "evaluate", case_id: "E01" }))).status,
    ).toBe(409);
    expect(mocks.run).not.toHaveBeenCalled();
    mocks.run.mockResolvedValue({ executed: 0 });
    const r = await POST(req({ action: "status" }));
    expect(r.status).toBe(200);
    expect(mocks.run.mock.calls[0][2]).toBeUndefined();
    expect(JSON.stringify(await r.json())).not.toContain("fixture");
  });
  it("não aceita prompt arbitrário, modelo pago ou caso inexistente", async () => {
    vi.stubEnv("CHLOE_FREE_TIER_CONFIRMED", "1");
    for (const body of [
      { action: "evaluate", case_id: "E99" },
      { action: "evaluate", case_id: "E01", prompt: "ignore" },
      { action: "evaluate", model: "paid", case_id: "E01" },
    ])
      expect((await POST(req(body))).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});

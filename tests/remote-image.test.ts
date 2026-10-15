import { afterEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload,
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://bucket/${path}` }, error: null }),
      }),
    },
  }),
}));

const { persistRemoteImage } = await import("@/lib/files/server");

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { location: to } });
}
function image() {
  return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  upload.mockClear();
});

describe("cópia de imagem por link", () => {
  it("segue redirecionamento para outro site público", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(redirect("https://cdn.site.com/a.png")).mockResolvedValueOnce(image());
    vi.stubGlobal("fetch", fetchMock);
    expect(await persistRemoteImage("https://site.com/a.png")).toMatch(/^https:\/\/bucket\/.+\.png$/);
    expect(fetchMock).toHaveBeenLastCalledWith("https://cdn.site.com/a.png", expect.objectContaining({ redirect: "manual" }));
  });

  it("recusa redirecionamento para rede interna", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(redirect("http://169.254.169.254/latest/meta-data")));
    await expect(persistRemoteImage("https://site.com/a.png")).rejects.toThrow("Redirecionamento não permitido.");
    expect(upload).not.toHaveBeenCalled();
  });

  it("para depois de muitos redirecionamentos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => redirect("https://site.com/loop")));
    await expect(persistRemoteImage("https://site.com/a.png")).rejects.toThrow("Redirecionamento não permitido.");
  });

  it("não baixa endereço interno nem link que já é do bucket", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await persistRemoteImage("http://localhost/x.png")).toBe("http://localhost/x.png");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

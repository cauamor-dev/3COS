import { describe, expect, it } from "vitest";
import { storagePath } from "@/lib/files/shared";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService } from "@/lib/central/service";

describe("imagens e arquivos", () => {
  it("guarda uma cópia da imagem quando uma IA salva, mas não quando é o próprio Cauã", async () => {
    const copied: string[] = [];
    const central = new CentralService(new MemoryRepository(), undefined, {
      persistImage: async (url) => {
        copied.push(url);
        return "https://armazenamento/copia.webp";
      },
    });
    const fromVega = await central.saveEntry({ area_slug: "inbox", titulo: "Achado", tipo: "post", imagem: "https://site.com/a.jpg" }, "claude");
    const mine = await central.saveEntry({ area_slug: "inbox", titulo: "Minha foto", imagem: "https://site.com/b.jpg" }, "manual");
    expect(copied).toEqual(["https://site.com/a.jpg"]);
    expect((await central.getEntry(fromVega.registro.id)).image_url).toBe("https://armazenamento/copia.webp");
    expect((await central.getEntry(mine.registro.id)).image_url).toBe("https://site.com/b.jpg");
  });

  it("mantém o link original se a cópia falhar", async () => {
    const central = new CentralService(new MemoryRepository(), undefined, { persistImage: async () => Promise.reject(new Error("offline")) });
    const { registro } = await central.saveEntry({ area_slug: "inbox", titulo: "X", imagem: "https://site.com/c.png" }, "chatgpt");
    expect((await central.getEntry(registro.id)).image_url).toBe("https://site.com/c.png");
  });

  it("gera caminhos aleatórios por mês com a extensão certa", () => {
    const path = storagePath("image/webp", new Date("2026-10-15T12:00:00Z"));
    expect(path).toMatch(/^2026\/10\/[0-9a-f-]{36}\.webp$/);
    expect(storagePath("application/pdf")).toMatch(/\.pdf$/);
  });
});

describe("tipos de arquivo", () => {
  it("deduz o tipo pela extensão e aceita documentos do Office", async () => {
    const { isAcceptedType, typeFromName } = await import("@/lib/files/shared");
    expect(typeFromName("curriculo.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(typeFromName("notas.MD")).toBe("text/markdown");
    expect(typeFromName("foto.jpeg")).toBe("image/jpeg");
    expect(typeFromName("virus.exe")).toBeUndefined();
    expect(isAcceptedType("application/pdf")).toBe(true);
    expect(isAcceptedType("application/x-msdownload")).toBe(false);
  });
});

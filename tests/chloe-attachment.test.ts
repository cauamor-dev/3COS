import { describe, expect, it } from "vitest";
import { attachmentNote } from "@/lib/chloe/attachment-note";

const photo = { url: "https://exemplo.test/a.webp", titulo: "foto.png", imagem: "https://exemplo.test/a.webp" };
const pdf = { url: "https://exemplo.test/b.pdf", titulo: "contrato.pdf" };

describe("anexo no campo da Chloe", () => {
  it("usa o texto como título e vai para a inbox", () => {
    const entry = attachmentNote("  print do erro  ", { imagem: photo.imagem, links: [photo] });
    expect(entry).toMatchObject({ area_slug: "inbox", tipo: "nota", titulo: "print do erro", conteudo: "print do erro", imagem: photo.imagem });
    expect(entry.links).toEqual([photo]);
  });

  it("sem texto usa o nome do arquivo", () => {
    expect(attachmentNote("", { links: [pdf] })).toMatchObject({ titulo: "contrato.pdf", conteudo: "" });
  });

  it("sem texto e vários arquivos conta os anexos", () => {
    expect(attachmentNote("", { links: [photo, pdf] }).titulo).toBe("2 anexos");
  });

  it("limita a 10 links e não inventa imagem", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ url: `https://exemplo.test/${i}.pdf` }));
    const entry = attachmentNote("lote", { links: many });
    expect(entry.links).toHaveLength(10);
    expect(entry).not.toHaveProperty("imagem");
  });
});

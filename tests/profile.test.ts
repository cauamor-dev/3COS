import { describe, expect, it } from "vitest";
import { buildProfile, parseProfile } from "@/lib/central/profile";

const doc = `# Perfil

Dev full stack em BH.

## Trabalho

Sistema interno, Angular + .NET.

## Projetos secretos

Algo que a Vega escreveu.

## Como as IAs devem me tratar

Direto ao ponto, em português.
`;

describe("perfil", () => {
  it("separa as seções conhecidas e preserva o resto", () => {
    const profile = parseProfile(doc);
    expect(profile.intro).toBe("# Perfil\n\nDev full stack em BH.");
    expect(profile.sections.trabalho).toBe("Sistema interno, Angular + .NET.");
    expect(profile.sections.ias).toBe("Direto ao ponto, em português.");
    expect(profile.sections.faculdade).toBe("");
    expect(profile.extra).toBe("## Projetos secretos\n\nAlgo que a Vega escreveu.");
  });

  it("reconstrói o documento na ordem das seções sem perder nada", () => {
    const profile = parseProfile(doc);
    profile.sections.faculdade = "Engenharia de Software, 5º período.";
    const rebuilt = buildProfile(profile);
    expect(rebuilt).toContain("## Trabalho\n\nSistema interno");
    expect(rebuilt.indexOf("## Faculdade")).toBeGreaterThan(rebuilt.indexOf("## Trabalho"));
    expect(rebuilt).toContain("## Projetos secretos");
    expect(parseProfile(rebuilt)).toEqual(profile);
  });

  it("perfil vazio ganha um título", () => {
    expect(buildProfile(parseProfile(""))).toBe("# Perfil\n");
  });
});

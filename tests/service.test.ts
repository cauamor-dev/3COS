import { beforeEach, describe, expect, it } from "vitest";
import { CentralError } from "@/lib/central/errors";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService, LIMITS } from "@/lib/central/service";

let repo: MemoryRepository;
let central: CentralService;

beforeEach(async () => {
  repo = new MemoryRepository();
  central = new CentralService(repo);
  await central.createArea({ nome: "Perfil", slug: "perfil", tipo: "perfil", resumo: "Cauã, dev full stack." }, "manual");
  await central.createArea({ nome: "Inbox", slug: "inbox", tipo: "pessoal" }, "manual");
});

describe("salvar registro", () => {
  it("cria a área automaticamente quando o slug não existe", async () => {
    const result = await central.saveEntry(
      { area_slug: "Axial App", titulo: "Kickoff", conteudo: "Começamos.", tipo: "progresso" },
      "claude",
    );

    expect(result.area_criada).toBe(true);
    expect(result.registro.area).toBe("axial-app");
    const area = await repo.findAreaBySlug("axial-app");
    expect(area).toMatchObject({ name: "Axial App", kind: "projeto", status: "ativo", updated_by: "claude" });
  });

  it("usa o tipo de área informado na criação", async () => {
    await central.saveEntry({ area_slug: "grafos", area_tipo: "faculdade", titulo: "Aula 1" }, "chatgpt");
    expect((await repo.findAreaBySlug("grafos"))?.kind).toBe("faculdade");
  });

  it("reaproveita a área existente e grava a fonte", async () => {
    await central.saveEntry({ area_slug: "orion", titulo: "A" }, "claude");
    const second = await central.saveEntry({ area_slug: "ORION", titulo: "B", tags: ["Back End"] }, "chatgpt");

    expect(second.area_criada).toBe(false);
    expect(repo.areas.filter((a) => a.slug === "orion")).toHaveLength(1);
    expect(repo.entries.at(-1)).toMatchObject({ source: "chatgpt", tags: ["back-end"] });
  });

  it("salva no inbox quando nenhuma área é informada", async () => {
    const result = await central.saveEntry({ titulo: "Ideia solta" }, "claude");
    expect(result.registro.area).toBe("inbox");
    expect(result.area_criada).toBe(false);
  });

  it("rejeita entrada inválida", async () => {
    await expect(central.saveEntry({ titulo: "" }, "claude")).rejects.toThrow();
  });
});

describe("versões", () => {
  it("guarda o resumo anterior antes de substituir", async () => {
    await central.updateSummary({ area_slug: "perfil", resumo: "Versão 2" }, "chatgpt");

    const area = await repo.findAreaBySlug("perfil");
    expect(area?.summary_md).toBe("Versão 2");
    expect(area?.updated_by).toBe("chatgpt");
    expect(repo.versions).toHaveLength(1);
    expect(repo.versions[0]).toMatchObject({
      target_table: "areas",
      target_id: area?.id,
      previous_content: "Cauã, dev full stack.",
      source: "chatgpt",
    });
  });

  it("não cria versão quando o conteúdo não muda ou a área é nova", async () => {
    await central.updateSummary({ area_slug: "perfil", resumo: "Cauã, dev full stack." }, "claude");
    await central.updateSummary({ area_slug: "nova", resumo: "Primeiro resumo" }, "claude");
    expect(repo.versions).toHaveLength(0);
  });

  it("muda o status junto com o resumo", async () => {
    await central.updateSummary({ area_slug: "perfil", resumo: "x", status: "pausado" }, "claude");
    expect((await repo.findAreaBySlug("perfil"))?.status).toBe("pausado");
  });

  it("versiona edição de conteúdo de registro e permite restaurar", async () => {
    const { registro } = await central.saveEntry({ area_slug: "axial", titulo: "Deploy", conteudo: "v1" }, "claude");
    await central.editEntry({ id: registro.id, conteudo: "v2" }, "chatgpt");

    const versions = await central.versions("entries", registro.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].previous_content).toBe("v1");

    await central.restoreVersion(versions[0].id, "manual");
    const restored = await repo.findEntryById(registro.id);
    expect(restored?.content_md).toBe("v1");
    expect(await central.versions("entries", registro.id)).toHaveLength(2);
  });

  it("arquivar guarda versão recuperável e esconde o registro das leituras", async () => {
    const { registro } = await central.saveEntry({ area_slug: "axial", titulo: "Velho" }, "claude");
    await central.editEntry({ id: registro.id, arquivado: true }, "claude");

    expect(repo.versions).toHaveLength(1);
    const area = await central.readArea({ slug: "axial" });
    expect(area.registros).toHaveLength(0);
    const withArchived = await central.readArea({ slug: "axial", incluir_arquivados: true });
    expect(withArchived.registros).toHaveLength(1);
  });

  it("restaura versão de resumo", async () => {
    await central.updateSummary({ area_slug: "perfil", resumo: "Errado" }, "chatgpt");
    const [version] = await central.versions("areas", repo.areas[0].id);
    await central.restoreVersion(version.id, "manual");
    expect((await repo.findAreaBySlug("perfil"))?.summary_md).toBe("Cauã, dev full stack.");
  });
});

describe("busca", () => {
  beforeEach(async () => {
    await central.saveEntry({ area_slug: "axial", titulo: "Decisão de banco", conteudo: "Usar Postgres no Supabase", tipo: "decisao" }, "claude");
    await central.saveEntry({ area_slug: "orion", titulo: "Tela de login", conteudo: "Formulário com validação" }, "chatgpt");
    await central.saveEntry({ area_slug: "orion", titulo: "Migração", conteudo: "Postgres 17" }, "chatgpt");
  });

  it("encontra por termo ignorando acentos e caixa", async () => {
    const result = await central.search({ consulta: "decisao" });
    expect(result.resultados.map((r) => r.titulo)).toEqual(["Decisão de banco"]);
  });

  it("filtra por área e por tipo", async () => {
    const byArea = await central.search({ consulta: "postgres", area: "orion" });
    expect(byArea.resultados.map((r) => r.titulo)).toEqual(["Migração"]);

    const byType = await central.search({ consulta: "postgres", tipo: "decisao" });
    expect(byType.resultados).toHaveLength(1);
  });

  it("pagina resultados", async () => {
    const first = await central.search({ consulta: "postgres", limite: 1 });
    expect(first.total).toBe(2);
    expect(first.proximo_offset).toBe(1);
    const second = await central.search({ consulta: "postgres", limite: 1, offset: 1 });
    expect(second.proximo_offset).toBeUndefined();
  });

  it("falha com mensagem útil para área inexistente", async () => {
    await expect(central.search({ consulta: "x", area: "nao-existe" })).rejects.toBeInstanceOf(CentralError);
  });
});

describe("respostas enxutas", () => {
  it("trunca registros longos em ler_area e entrega completo em ler_registro", async () => {
    const long = "texto ".repeat(500);
    const { registro } = await central.saveEntry({ area_slug: "axial", titulo: "Longo", conteudo: long }, "claude");

    const area = await central.readArea({ slug: "axial" });
    const item = area.registros[0];
    expect(item.truncado).toBe(true);
    expect(item.total_caracteres).toBe(long.length);
    expect(item.conteudo.length).toBeLessThanOrEqual(LIMITS.entryInList + 1);

    const full = await central.readEntry({ id: registro.id });
    expect(full.registro.conteudo).toBe(long);
    expect(full.registro.truncado).toBeUndefined();
  });

  it("pagina a lista de áreas", async () => {
    for (let i = 0; i < 5; i++) await central.createArea({ nome: `Área ${i}` }, "manual");
    const page = await central.listAreas({ limite: 3 });
    expect(page.areas).toHaveLength(3);
    expect(page.total).toBe(7);
    expect(page.proximo_offset).toBe(3);
  });

  it("briefing traz perfil e deixa áreas especiais fora das ativas", async () => {
    await central.saveEntry({ area_slug: "axial", titulo: "Novo" }, "claude");
    const briefing = await central.briefing();

    expect(briefing.perfil).toBe("Cauã, dev full stack.");
    expect(briefing.areas_ativas.map((a) => a.slug)).toEqual(["axial"]);
    expect(briefing.registros_recentes.itens[0].titulo).toBe("Novo");
  });
});

describe("importação", () => {
  it("usa o título do markdown e cria um registro por arquivo", async () => {
    const result = await central.importFiles(
      {
        area_slug: "faculdade-grafos",
        arquivos: [
          { nome: "aula1.md", conteudo: "# Aula 1\n\nBFS e DFS" },
          { nome: "aula2.md", conteudo: "Dijkstra" },
        ],
      },
      "manual",
    );
    expect(result.imported).toBe(2);
    const titles = repo.entries.map((e) => e.title).sort();
    expect(titles).toEqual(["Aula 1", "aula2"]);
  });
});

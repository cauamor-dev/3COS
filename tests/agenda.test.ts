import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService } from "@/lib/central/service";
import { occurrencesBetween, startOfLocalDay, stepRecurrence, toIsoStart } from "@/lib/central/time";

let repo: MemoryRepository;
let central: CentralService;

beforeEach(async () => {
  repo = new MemoryRepository();
  central = new CentralService(repo);
  await central.createArea({ nome: "Inbox", slug: "inbox", tipo: "pessoal" }, "manual");
});

describe("datas no fuso de São Paulo", () => {
  it("interpreta data sem hora como meia-noite local", () => {
    expect(toIsoStart("2026-10-20")).toBe("2026-10-20T03:00:00.000Z");
  });

  it("calcula o início do dia local", () => {
    expect(startOfLocalDay(Date.parse("2026-10-20T02:00:00Z")).toISOString()).toBe("2026-10-19T03:00:00.000Z");
  });

  it("repete mensalmente mantendo o horário local", () => {
    const next = stepRecurrence(new Date("2026-10-31T22:00:00Z"), "mensal");
    expect(next.toISOString()).toBe("2026-12-01T22:00:00.000Z");
  });

  it("expande ocorrências semanais dentro do período", () => {
    const list = occurrencesBetween(
      "2026-10-05T22:00:00Z",
      "2026-10-05T23:00:00Z",
      "semanal",
      new Date("2026-10-10T00:00:00Z"),
      new Date("2026-10-31T00:00:00Z"),
    );
    expect(list.map((o) => o.start.toISOString())).toEqual([
      "2026-10-12T22:00:00.000Z",
      "2026-10-19T22:00:00.000Z",
      "2026-10-26T22:00:00.000Z",
    ]);
  });
});

describe("eventos e tarefas", () => {
  it("exige início para eventos", async () => {
    await expect(central.saveEntry({ titulo: "Reunião", tipo: "evento" }, "claude")).rejects.toThrow();
  });

  it("salva evento com horário, local e lembrete", async () => {
    const { registro } = await central.saveEntry(
      {
        titulo: "Prova de Grafos",
        tipo: "evento",
        inicio: "2026-11-03T19:00:00-03:00",
        fim: "2026-11-03T22:30:00-03:00",
        local: "PUC Betim",
        lembrar_em: "2026-11-03T08:00:00-03:00",
      },
      "chatgpt",
    );
    expect(registro).toMatchObject({
      inicio: "2026-11-03T22:00:00.000Z",
      fim: "2026-11-04T01:30:00.000Z",
      local: "PUC Betim",
      lembrar_em: "2026-11-03T11:00:00.000Z",
    });
  });

  it("marca evento só com data como dia inteiro", async () => {
    await central.saveEntry({ titulo: "Aniversário", tipo: "evento", inicio: "2026-12-10", recorrencia: "anual" }, "manual");
    expect(repo.entries[0]).toMatchObject({ all_day: true, recurrence: "anual" });
  });

  it("monta a agenda com ocorrências, atrasadas e tarefas do período", async () => {
    const today = startOfLocalDay();
    const tomorrow = new Date(today.getTime() + 24 * 3600_000 + 20 * 3600_000).toISOString();
    await central.saveEntry({ titulo: "Daily", tipo: "evento", inicio: tomorrow, recorrencia: "diaria" }, "manual");
    await central.saveEntry({ titulo: "Atrasada", tipo: "tarefa", prazo: "2020-01-01" }, "manual");
    await central.saveEntry({ titulo: "Para amanhã", tipo: "tarefa", prazo: tomorrow }, "manual");

    const agenda = await central.agenda();
    expect(agenda.eventos.length).toBeGreaterThanOrEqual(6);
    expect(agenda.eventos[0].titulo).toBe("Daily");
    expect(agenda.tarefas_atrasadas.map((t) => t.titulo)).toEqual(["Atrasada"]);
    expect(agenda.tarefas_no_periodo.map((t) => t.titulo)).toEqual(["Para amanhã"]);
  });

  it("conclui e reabre tarefas", async () => {
    const { registro } = await central.saveEntry({ titulo: "Enviar currículo", tipo: "tarefa" }, "claude");
    await central.editEntry({ id: registro.id, concluida: true }, "claude");
    expect((await central.listTasks()).tarefas).toHaveLength(0);
    expect((await central.listTasks({ status: "concluidas" })).tarefas[0].concluida).toBe(true);

    await central.editEntry({ id: registro.id, concluida: false }, "claude");
    expect((await central.listTasks()).tarefas).toHaveLength(1);
  });

  it("guarda links e imagem em posts", async () => {
    const { registro } = await central.saveEntry(
      {
        titulo: "Next.js 17 lançado",
        tipo: "post",
        conteudo: "Resumo da novidade",
        links: [{ url: "https://nextjs.org/blog", titulo: "Blog do Next" }],
        imagem: "https://nextjs.org/og.png",
      },
      "chatgpt",
    );
    expect(registro).toMatchObject({ imagem: "https://nextjs.org/og.png", links: [{ url: "https://nextjs.org/blog" }] });
    const feed = await central.feed({ tipo: "post" });
    expect(feed.items).toHaveLength(1);
  });
});

describe("lembretes", () => {
  it("dispara lembretes vencidos, marca os únicos e avança os recorrentes", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60_000).toISOString();
    await central.saveEntry({ titulo: "Ligar pro Lott", tipo: "tarefa", lembrar_em: past }, "claude");
    await central.saveEntry(
      { titulo: "Academia", tipo: "evento", inicio: past, recorrencia: "diaria", lembrar_em: past },
      "manual",
    );
    await central.saveEntry({ titulo: "Futuro", tipo: "tarefa", lembrar_em: new Date(now.getTime() + 3600_000).toISOString() }, "manual");

    const sent: string[] = [];
    const count = await central.dispatchReminders(async (notice) => sent.push(notice.title), now);

    expect(count).toBe(2);
    expect(sent).toEqual(["Lembrete: Ligar pro Lott", "Academia"]);
    expect(repo.entries[0].reminded_at).not.toBeNull();
    expect(repo.entries[1].reminded_at).toBeNull();
    expect(new Date(repo.entries[1].remind_at!).getTime()).toBeGreaterThan(now.getTime());

    expect(await central.dispatchReminders(async () => {}, now)).toBe(0);
  });

  it("monta o resumo diário com atrasadas e inbox", async () => {
    await central.saveEntry({ titulo: "Atrasada", tipo: "tarefa", prazo: "2020-01-01" }, "manual");
    await central.saveEntry({ titulo: "Ideia solta" }, "manual");
    const summary = await central.dailySummary();
    expect(summary.title).toMatch(/^Bom dia!/);
    expect(summary.lines).toContain("Atrasada · Atrasada");
    expect(summary.lines.some((line) => line.includes("inbox"))).toBe(true);
  });
});

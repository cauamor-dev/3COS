import "server-only";
import { demoCentral } from "@/lib/central/demo";
import type { TeamSnapshot } from "./types";

/** Fictional fixtures, only called from the development-only demo. */
export async function demoTeamSnapshot(
  base: TeamSnapshot,
): Promise<TeamSnapshot> {
  const central = await demoCentral();
  const areas = await central.listAllAreas();
  const area = areas.find((a) => a.slug === "atlas")!;
  const entries = (await central.feed()).items.filter(
    (e) => e.area_id === area.id,
  );
  const people = [
    ["Clara", "clara", "Coordenação e única ponte com a Central"],
    ["Rastro", "rastro", "Vendas e marketing"],
    ["Tereza", "tereza", "Arquitetura de projetos e QA"],
    ["Atlas", "atlas", "Carreira e estudos"],
  ];
  const agents = people.map(([name, handle, role], i) => ({
    id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    name,
    handle,
    role,
    platform: "grok",
    active: false,
    external_active: false,
    retired_at: null,
  }));
  const works = entries.slice(0, 3).map((entry, i) => ({
    entry_id: entry.id,
    area_id: area.id,
    objective: entry.title,
    assigned_agent_id: agents[i].id,
    bridge_agent_id: agents[0].id,
    status: ["waiting_executor", "waiting_approval", "delivered"][i],
    current_step: [
      "Preparar proposta para revisão",
      "Conferir o texto e o destino",
      "Revisão concluída no exemplo",
    ][i],
    expected_output: "Documento com proposta e próximos passos.",
    acceptance_criteria: "Texto revisado e referências conferidas.",
    last_error: null,
    due_at: null,
  }));
  const threadId = "00000000-0000-4000-8000-000000000010";
  return {
    ...base,
    agents,
    works,
    threads: [
      {
        id: threadId,
        title: "Proposta · Atlas Studio",
        area_id: area.id,
        participants: [agents[0].id, agents[2].id],
        visibility: "shared",
        entry_id: works[0]?.entry_id,
      },
    ],
    demoMessages: {
      [threadId]: [
        {
          id: "00000000-0000-4000-8000-000000000012",
          body: "Vamos revisar a proposta antes de enviar. O próximo passo está no cartão.",
          source: "manual",
          agent_id: null,
          actor_id: "demo",
          created_at: new Date().toISOString(),
          origin_chat_title: null,
          entry_id: works[0]?.entry_id ?? null,
          refs: [],
          reply_to: null,
        },
        {
          id: "00000000-0000-4000-8000-000000000011",
          body: "Aqui ficam as decisões do projeto, os arquivos e a conversa ligados ao trabalho.",
          source: "manual",
          agent_id: null,
          actor_id: "demo",
          created_at: new Date(Date.now() - 60000).toISOString(),
          origin_chat_title: null,
          entry_id: null,
          refs: [],
          reply_to: null,
        },
      ],
    },
  };
}

import type { TeamWork } from "./types";

export const BOARD_COLUMNS = [
  { id: "todo", title: "A fazer" },
  { id: "doing", title: "Em andamento" },
  { id: "review", title: "Precisa de você" },
  { id: "done", title: "Concluídos" },
] as const;
export function workColumn(
  status: string,
): (typeof BOARD_COLUMNS)[number]["id"] {
  if (status === "running") return "doing";
  if (["delivered", "cancelled"].includes(status)) return "done";
  if (["queued", "waiting_executor"].includes(status)) return "todo";
  return "review";
}
export function filterWorks(works: TeamWork[], query: string, areaId: string) {
  const q = query.trim().toLocaleLowerCase("pt-BR");
  return works.filter(
    (w) =>
      (areaId === "all" || w.area_id === areaId) &&
      (!q ||
        `${w.objective} ${w.current_step}`
          .toLocaleLowerCase("pt-BR")
          .includes(q)),
  );
}

import { describe, expect, it } from "vitest";
import { noticePath } from "@/lib/central/links";
import { filterWorks, workColumn } from "@/lib/team/board";
import type { TeamWork } from "@/lib/team/types";
describe("Abrir o item exato", () => {
  it("recupera o destino de avisos antigos que só apontavam para uma área", () => {
    expect(
      noticePath({
        kind: "reminder",
        entry_id: "registro",
        path: "/areas/projeto",
      }),
    ).toBe("/registros/registro");
    expect(
      noticePath({ kind: "approval", entry_id: "trabalho", path: "/equipe" }),
    ).toBe("/equipe?work=trabalho&tab=approvals");
    expect(
      noticePath({ kind: "delivery", entry_id: "trabalho", path: "/equipe" }),
    ).toBe("/equipe?work=trabalho");
    expect(noticePath({ kind: "reminder", path: "//example.com" })).toBe(
      "/notificacoes",
    );
  });
  it("separa trabalho bloqueado de concluído e preserva o filtro de projeto", () => {
    expect(workColumn("waiting_approval")).toBe("review");
    expect(workColumn("blocked")).toBe("review");
    expect(workColumn("delivered")).toBe("done");
    const works = [
      { objective: "Proposta", current_step: "Revisar", area_id: "a" },
      { objective: "Proposta", current_step: "Revisar", area_id: "b" },
    ] as TeamWork[];
    expect(filterWorks(works, "proposta", "a")).toHaveLength(1);
  });
});

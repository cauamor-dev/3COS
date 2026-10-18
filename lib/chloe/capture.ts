import { z } from "zod";
import type { CentralService } from "@/lib/central/service";
export const captureInput = z.object({
  text: z.string().min(1).max(50000),
  mode: z.enum(["anotar", "perguntar", "equipe"]).default("anotar"),
});
export async function captureNote(central: CentralService, text: string) {
  const input = captureInput.parse({ text });
  const title = input.text.trim().split(/\r?\n/)[0].slice(0, 200);
  const query = title.split(/\s+/).slice(0, 6).join(" ").slice(0, 180);
  const possible = query
    ? await central.searchEntries(query, { limit: 5 })
    : { items: [] };
  const { registro } = await central.saveEntry(
    {
      area_slug: "inbox",
      tipo: "nota",
      titulo: title || "Anotação",
      conteudo: input.text,
      original_text: input.text,
    },
    "manual",
  );
  return {
    registro,
    duplicates: possible.items.map((e) => ({ id: e.id, title: e.title })),
  };
}

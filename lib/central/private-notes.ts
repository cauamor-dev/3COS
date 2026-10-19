import { z } from "zod";
import type { CentralService } from "./service";

const privateNote = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(50000),
});

/** Ignore caller visibility/area: this entry point always creates an owner-private note. */
export async function savePrivateNote(central: CentralService, raw: unknown) {
  if (central.actor.kind !== "human" || !central.actor.userId)
    throw new Error("Proprietário autenticado necessário.");
  const input = privateNote.parse(raw);
  return central.saveEntry(
    {
      area_slug: "area-segura",
      area_nome: "Área segura",
      area_tipo: "pessoal",
      tipo: "nota",
      titulo: input.title,
      conteudo: input.content,
      ai_access: "private",
    },
    "manual",
  );
}

import type { SaveEntryInput } from "@/lib/central/schemas";

export type ChloeFiles = Pick<SaveEntryInput, "imagem" | "links">;

const MAX_LINKS = 10;

/** Note for the inbox when the command bar is sent with files: the text is the title, or the file name when empty. */
export function attachmentNote(text: string, files: ChloeFiles): SaveEntryInput {
  const note = text.trim().slice(0, 500);
  const links = (files.links ?? []).slice(0, MAX_LINKS);
  const first = links[0]?.titulo?.trim();
  const title = note || (links.length > 1 ? `${links.length} anexos` : first || "Anexo");
  return {
    area_slug: "inbox",
    tipo: "nota",
    titulo: title.slice(0, 200),
    conteudo: note,
    links,
    ...(files.imagem && { imagem: files.imagem }),
  };
}

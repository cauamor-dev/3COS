import JSZip from "jszip";
import { slugify } from "./text";
import type { Area, Entry } from "./types";

function frontmatter(values: Record<string, string | string[] | boolean>) {
  const lines = Object.entries(values).map(([key, value]) =>
    Array.isArray(value) ? `${key}: [${value.map((v) => JSON.stringify(v)).join(", ")}]` : `${key}: ${JSON.stringify(value)}`,
  );
  return `---\n${lines.join("\n")}\n---\n\n`;
}

export async function exportMarkdownZip({ areas, entries }: { areas: Area[]; entries: Entry[] }) {
  const zip = new JSZip();

  for (const area of areas) {
    const folder = zip.folder(area.slug)!;
    folder.file(
      "README.md",
      frontmatter({ nome: area.name, tipo: area.kind, status: area.status, atualizado_em: area.updated_at, atualizado_por: area.updated_by }) +
        `# ${area.name}\n\n${area.summary_md}\n`,
    );

    const used = new Set<string>();
    for (const entry of entries.filter((e) => e.area_id === area.id)) {
      const base = `${entry.created_at.slice(0, 10)}-${slugify(entry.title) || "registro"}`;
      let name = base;
      for (let i = 2; used.has(name); i++) name = `${base}-${i}`;
      used.add(name);
      folder.file(
        `registros/${name}.md`,
        frontmatter({
          id: entry.id,
          tipo: entry.type,
          fonte: entry.source,
          tags: entry.tags,
          fixado: entry.pinned,
          arquivado: entry.archived,
          criado_em: entry.created_at,
          atualizado_em: entry.updated_at,
        }) + `# ${entry.title}\n\n${entry.content_md}\n`,
      );
    }
  }

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

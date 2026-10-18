import { createClient } from "@supabase/supabase-js";
const catalog = process.argv.includes("--catalog");
const apply = process.argv.includes("--apply") || catalog;
if (
  process.argv.includes("--apply") &&
  process.env.CENTRAL_FILE_LINKS_READY !== "1"
)
  throw new Error(
    "Valide o acesso da URL canônica antes de alterar referências. Use --catalog para preservar links atuais.",
  );
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
const canonical = (
  process.env.CENTRAL_CANONICAL_URL ?? process.env.NEXT_PUBLIC_APP_URL
).replace(/\/$/, "");
const result = await db
  .from("entries")
  .select("id,owner_id,area_id,links,image_url,ai_access,revision");
if (result.error)
  throw new Error("Não foi possível inspecionar metadados de anexos.");
const references = new Map();
function objectPath(raw) {
  try {
    const u = new URL(raw);
    const prefix = "/storage/v1/object/sign/arquivos/";
    if (u.origin !== origin || !u.pathname.startsWith(prefix)) return null;
    const p = decodeURIComponent(u.pathname.slice(prefix.length));
    if (p.split("/").some((s) => s === ".." || s === ".") || !p) return null;
    return p;
  } catch {
    return null;
  }
}
for (const e of result.data) {
  for (const raw of [
    e.image_url,
    ...(e.links ?? []).flatMap((l) => [l.url, l.imagem]),
  ].filter(Boolean)) {
    const p = objectPath(raw);
    if (!p) continue;
    const current = references.get(p);
    const importance = { shared: 0, restricted: 1, private: 2 };
    if (
      !current ||
      importance[e.ai_access] > importance[current.entry.ai_access]
    )
      references.set(p, {
        entry: e,
        url: raw,
        name: e.links?.find((l) => l.url === raw)?.titulo ?? "Anexo existente",
      });
  }
}
console.log(
  JSON.stringify({
    mode: apply ? "apply" : "inspect",
    objects_referenced: references.size,
    entry_count: result.data.length,
    secret_urls_printed: false,
    old_capabilities_revoked: false,
  }),
);
if (!apply) process.exit(0);
const mapping = new Map();
for (const [p, ref] of references) {
  const info = await db.storage.from("arquivos").info(p);
  if (info.error || !info.data)
    throw new Error(
      "Objeto referenciado não encontrado; migração interrompida sem excluir arquivos.",
    );
  const metadata = info.data.metadata ?? {};
  const upsert = await db
    .from("artifacts")
    .upsert(
      {
        object_path: p,
        owner_id: ref.entry.owner_id,
        entry_id: ref.entry.id,
        area_id: ref.entry.area_id,
        name: ref.name,
        mime:
          metadata.mimetype ??
          info.data.contentType ??
          "application/octet-stream",
        size_bytes: Number(metadata.size ?? info.data.size ?? 0),
        visibility:
          ref.entry.ai_access === "private"
            ? "private"
            : ref.entry.ai_access === "restricted"
              ? "restricted"
              : "shared",
        status: "ready",
      },
      { onConflict: "object_path" },
    )
    .select("id")
    .single();
  if (upsert.error)
    throw new Error("Falha no catálogo de arquivos; metadados omitidos.");
  mapping.set(p, `${canonical}/api/files/${upsert.data.id}`);
}
if (catalog) {
  console.log(
    JSON.stringify({
      cataloged: references.size,
      entries_migrated: 0,
      deletions: 0,
      legacy_links_preserved: true,
    }),
  );
  process.exit(0);
}
let changed = 0;
for (const e of result.data) {
  const replace = (raw) => {
    const p = objectPath(raw);
    return p && mapping.has(p) ? mapping.get(p) : raw;
  };
  const links = (e.links ?? []).map((l) => ({
    ...l,
    url: replace(l.url),
    ...(l.imagem ? { imagem: replace(l.imagem) } : {}),
  }));
  const image = e.image_url ? replace(e.image_url) : null;
  if (
    JSON.stringify(links) === JSON.stringify(e.links) &&
    image === e.image_url
  )
    continue;
  const update = await db.rpc("edit_entry_atomic", {
    p_id: e.id,
    p_revision: e.revision,
    p_patch: { links, image_url: image, updated_by: "codex" },
  });
  if (update.error)
    throw new Error(
      "Registro mudou durante migração; referências anteriores preservadas no snapshot e nenhuma edição concorrente sobrescrita.",
    );
  changed++;
}
console.log(
  JSON.stringify({
    cataloged: references.size,
    entries_migrated: changed,
    deletions: 0,
    old_capabilities_revoked: false,
    next_step:
      "Links antigos continuam válidos; revogação por objeto exige migração controlada. Nenhuma exclusão em massa executada.",
  }),
);

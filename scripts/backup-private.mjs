import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const dir = path.resolve(
  ".private-backups",
  new Date().toISOString().replaceAll(":", "-"),
);
await fs.mkdir(dir, { recursive: true });
const manifest = {
  created_at: new Date().toISOString(),
  tables: {},
  objects: [],
  format: 2,
  consistency:
    "Application snapshot per table; not a physical point-in-time database backup.",
};
const identities = await db.auth.admin.listUsers({ page: 1, perPage: 100 });
if (identities.error)
  throw new Error(
    "Falha ao identificar proprietários para recuperação isolada.",
  );
await fs.writeFile(
  path.join(dir, "auth-identities.json"),
  JSON.stringify(
    identities.data.users.map((u) => ({ id: u.id, email: u.email })),
  ),
  { mode: 0o600 },
);
for (const table of [
  "areas",
  "entries",
  "versions",
  "members",
  "settings",
  "news_feeds",
  "news_items",
  "trash",
  "agents",
  "integration_clients",
  "client_area_grants",
  "team_threads",
  "team_messages",
  "work_items",
  "work_runs",
  "run_events",
  "action_approvals",
  "artifacts",
  "automation_schedules",
  "integration_status",
  "usage_daily",
  "usage_reservations",
  "operation_receipts",
  "execution_control",
  "personal_finance_imports",
  "personal_transactions",
  "chloe_conversations",
  "chloe_messages",
  "career_opportunities",
  "push_subscriptions",
  "notification_preferences",
  "notifications",
  "client_rate_windows",
]) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const r = await db
      .from(table)
      .select("*")
      .range(offset, offset + 499);
    if (r.error) throw new Error(`Falha no backup de ${table}`);
    rows.push(...r.data);
    if (r.data.length < 500) break;
  }
  const data = JSON.stringify(rows);
  const file = path.join(dir, `${table}.json`);
  await fs.writeFile(file, data, { mode: 0o600 });
  const restored = JSON.parse(await fs.readFile(file, "utf8"));
  if (restored.length !== rows.length)
    throw new Error("Verificação de backup falhou");
  manifest.tables[table] = {
    rows: rows.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}
const objectsRoot = path.join(dir, "objects");
await fs.mkdir(objectsRoot, { recursive: true });
const folders = [""];
let storedBytes = 0;
while (folders.length) {
  const prefix = folders.shift();
  const list = await db.storage
    .from("arquivos")
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (list.error) throw new Error("Falha ao listar arquivos privados.");
  if (list.data.length >= 1000)
    throw new Error(
      "Pasta grande demais para o snapshot limitado; dividir o backup.",
    );
  for (const object of list.data) {
    const objectName = [prefix, object.name].filter(Boolean).join("/");
    if (!object.id) {
      folders.push(objectName);
      continue;
    }
    const target = path.resolve(objectsRoot, objectName);
    if (!target.startsWith(objectsRoot + path.sep))
      throw new Error("Caminho de arquivo fora do backup.");
    storedBytes += Number(object.metadata?.size ?? 0);
    if (storedBytes > 100 * 1024 * 1024)
      throw new Error(
        "Snapshot de arquivos limitado a 100 MB; nenhum serviço pago ativado.",
      );
    const downloaded = await db.storage.from("arquivos").download(objectName);
    if (downloaded.error || !downloaded.data)
      throw new Error("Falha ao copiar arquivo privado.");
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { mode: 0o600 });
    manifest.objects.push({
      path: objectName,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}
await fs.writeFile(
  path.join(dir, "manifest.json"),
  JSON.stringify(manifest, null, 2),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    ok: true,
    directory: dir,
    counts: Object.fromEntries(
      Object.entries(manifest.tables).map(([k, v]) => [k, v.rows]),
    ),
    objects: manifest.objects.length,
    object_bytes: storedBytes,
  }),
);

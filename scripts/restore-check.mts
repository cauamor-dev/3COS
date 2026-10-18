import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { testDatabase } from "../tests/db-fixture";
const dir = path.resolve(process.argv[2] ?? "");
if (!dir.startsWith(path.resolve(".private-backups") + path.sep))
  throw new Error("Use apenas um snapshot privado deste workspace.");
const manifest = JSON.parse(
  await fs.readFile(path.join(dir, "manifest.json"), "utf8"),
);
const db = await testDatabase(); // Always isolated in-memory PostgreSQL; never a remote connection.
const counts: Record<string, number> = {};
try {
  if (manifest.format === 2) {
    const tables = await db.query<{ name: string }>(
      "select tablename name from pg_tables where schemaname='public'",
    );
    await db.exec(
      "set session_replication_role=replica;truncate " +
        tables.rows
          .map((t) => 'public."' + t.name.replaceAll('"', '""') + '"')
          .join(",") +
        ",auth.users cascade",
    );
    const identities = JSON.parse(
      await fs.readFile(path.join(dir, "auth-identities.json"), "utf8"),
    );
    await db.query(
      "insert into auth.users(id,email) select id,email from jsonb_populate_recordset(null::auth.users,$1::jsonb)",
      [JSON.stringify(identities)],
    );
  }
  for (const table of manifest.format === 2
    ? Object.keys(manifest.tables)
    : ["areas", "entries", "versions"]) {
    const bytes = await fs.readFile(path.join(dir, `${table}.json`), "utf8");
    if (
      createHash("sha256").update(bytes).digest("hex") !==
      manifest.tables[table].sha256
    )
      throw new Error(`Integridade inválida: ${table}`);
    const rows = JSON.parse(bytes) as Record<string, unknown>[];
    const columns = (
      await db.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER' order by ordinal_position",
        [table],
      )
    ).rows
      .map((r) => r.column_name)
      .filter((k) => rows[0] && k in rows[0]);
    try {
      if (rows.length)
        await db.query(
          `insert into public.${table}(${columns.map((k) => '"' + k + '"').join(",")}) select ${columns.map((k) => '"' + k + '"').join(",")} from jsonb_populate_recordset(null::public.${table},$1::jsonb)`,
          [JSON.stringify(rows)],
        );
    } catch {
      throw new Error(
        `Restauração isolada falhou em ${table}; conteúdo privado omitido.`,
      );
    }
    counts[table] = (
      await db.query<{ n: number }>(
        `select count(*)::int n from public.${table}`,
      )
    ).rows[0].n;
    if (counts[table] !== manifest.tables[table].rows)
      throw new Error(`Contagem inválida: ${table}`);
  }
  if (manifest.format === 2) {
    await db.exec(
      "set session_replication_role=origin;select setval('public.work_fence_seq',greatest(coalesce((select max(fencing_token) from public.work_runs),0),1),true)",
    );
    const keys = await db.query<{
      child: string;
      parent: string;
      cols: string[];
      refs: string[];
    }>(
      `select conrelid::regclass::text child,confrelid::regclass::text parent,array(select attname::text from unnest(conkey) with ordinality k(id,ord) join pg_attribute a on a.attrelid=conrelid and a.attnum=k.id order by ord) cols,array(select attname::text from unnest(confkey) with ordinality k(id,ord) join pg_attribute a on a.attrelid=confrelid and a.attnum=k.id order by ord) refs from pg_constraint where contype='f' and connamespace='public'::regnamespace`,
    );
    for (const k of keys.rows) {
      const orphan = await db.query<{ n: number }>(
        `select count(*)::int n from ${k.child} c where ${k.cols.map((c) => 'c."' + c + '" is not null').join(" and ")} and not exists(select 1 from ${k.parent} p where ${k.cols.map((c, i) => 'c."' + c + '"=p."' + k.refs[i] + '"').join(" and ")})`,
      );
      if (orphan.rows[0].n)
        throw new Error("Referência órfã no snapshot; dados omitidos.");
    }
  }
  for (const object of manifest.objects ?? []) {
    const file = path.resolve(dir, "objects", object.path);
    if (!file.startsWith(path.join(dir, "objects") + path.sep))
      throw new Error("Caminho fora do snapshot.");
    const bytes = await fs.readFile(file);
    if (
      bytes.length !== object.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== object.sha256
    )
      throw new Error("Integridade de arquivo inválida.");
  }
  console.log(
    JSON.stringify({
      restoration_verified: true,
      isolated_postgres: true,
      counts,
      objects_verified: manifest.objects?.length ?? 0,
      private_contents_printed: false,
    }),
  );
} finally {
  await db.close();
}

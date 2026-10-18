import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

/** Real PostgreSQL engine in memory; only hosted Auth/Storage are stubbed. No production data. */
export async function testDatabase() {
  const db = new PGlite({ extensions: { unaccent } });
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb not null default '{}');
    create schema extensions; create schema cron;
    create function cron.schedule(text,text,text) returns integer language sql as $$select 1$$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email',current_setting('request.jwt.claim.email',true)) $$;
    grant usage on schema auth to authenticated,anon,service_role;
    grant execute on all functions in schema auth to authenticated,anon,service_role;
  `);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql") && !f.includes("20261018"))
    .sort()) {
    const sql = readFileSync(join("supabase/migrations", file), "utf8")
      .replace(/alter publication[^;]+;/g, "")
      .replace(/create extension if not exists (pg_cron|pg_net);/g, "");
    await db.exec(sql);
  }
  await db.exec(`
    insert into auth.users values('00000000-0000-4000-8000-000000000001','owner@example.test');
    insert into public.members(email) values('owner@example.test');
    grant select,insert,update on public.entries,public.areas,public.versions to authenticated,service_role;
    grant select on public.members to authenticated,service_role;
    grant execute on function public.is_member() to authenticated;
  `);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.includes("20261018"))
    .sort()) {
    const sql = readFileSync(join("supabase/migrations", file), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      const e = error as Error & {
        position?: string;
        internalPosition?: string;
        internalQuery?: string;
      };
      throw new Error(
        `${file}: ${e.message}; position=${e.position}; internal=${e.internalPosition}; ${e.internalQuery ?? ""}`,
      );
    }
  }
  return db;
}

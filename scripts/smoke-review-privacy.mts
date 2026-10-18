import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { sharedReviewWorks } from "../lib/work/review";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const checks: { name: string; passed: boolean }[] = [];
function check(name: string, passed: boolean) {
  checks.push({ name, passed });
  if (!passed) throw new Error(`Falhou: ${name}`);
}
const area = await db
  .from("areas")
  .select("id")
  .eq("slug", "validacao-3c")
  .single();
if (area.error) throw new Error("Área de teste ausente.");
const work = await db
  .from("work_items")
  .select("entry_id")
  .eq("area_id", area.data.id)
  .eq("objective", "Validar leitura, posse e entrega operacional do Codex")
  .limit(1)
  .single();
if (work.error)
  throw new Error("Execute o smoke de integração antes deste teste.");
const original = await db
  .from("entries")
  .select("ai_access,archived,revision")
  .eq("id", work.data.entry_id)
  .single();
if (
  original.error ||
  original.data.ai_access !== "shared" ||
  original.data.archived
)
  throw new Error(
    "Fixture de teste foi alterada; não modificar dados do usuário.",
  );
let revision = original.data.revision;
try {
  const visible = await sharedReviewWorks(db).eq(
    "entry_id",
    work.data.entry_id,
  );
  check(
    "Consulta real aceita join e filtros antes de agregar",
    !visible.error && visible.data?.length === 1,
  );
  for (const access of ["private", "restricted"]) {
    const changed = await db
      .from("entries")
      .update({ ai_access: access, updated_by: "codex" })
      .eq("id", work.data.entry_id)
      .eq("revision", revision)
      .select("revision")
      .single();
    if (changed.error)
      throw new Error("Conflito na fixture; teste interrompido.");
    revision = changed.data.revision;
    const denied = await sharedReviewWorks(db).eq(
      "entry_id",
      work.data.entry_id,
    );
    check(
      `Resumo não carrega trabalho ${access}`,
      !denied.error && denied.data?.length === 0,
    );
  }
} finally {
  const restored = await db
    .from("entries")
    .update({ ai_access: original.data.ai_access, updated_by: "codex" })
    .eq("id", work.data.entry_id)
    .eq("revision", revision)
    .select("id");
  check(
    "Privacidade original da fixture restaurada",
    !restored.error && restored.data?.length === 1,
  );
  await fs.mkdir(".local-reports", { recursive: true });
  await fs.writeFile(
    ".local-reports/review-privacy-smoke.json",
    JSON.stringify({ tested_at: new Date().toISOString(), checks }, null, 2),
  );
  console.log(JSON.stringify({ checks }));
}

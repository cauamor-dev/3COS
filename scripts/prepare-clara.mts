import fs from "node:fs/promises";
import { createAdminClient } from "../lib/supabase/admin";
import { adminCentral } from "../lib/central/server";
import { serverEnv } from "../lib/env";
import {
  claraFixtures,
  claraTestPrompt,
} from "../lib/integrations/clara-setup";
const db = createAdminClient();
const users = await db.auth.admin.listUsers({ page: 1, perPage: 50 });
if (users.error) throw new Error("Não foi possível conferir o proprietário.");
const owner = users.data.users.find(
  (u) => u.email?.toLowerCase() === serverEnv.allowedEmail,
);
if (!owner) throw new Error("Proprietário autorizado não encontrado.");
const central = adminCentral({
  kind: "human",
  id: owner.id,
  userId: owner.id,
  source: "codex",
});
const fixture = await claraFixtures(db, central);
await fs.mkdir(".local-reports", { recursive: true });
await fs.writeFile(
  ".local-reports/clara-teste-pronto.txt",
  claraTestPrompt(fixture),
);
await fs.writeFile(
  ".local-reports/clara-setup.json",
  JSON.stringify(
    {
      ...fixture,
      prepared_at: new Date().toISOString(),
      token_created: false,
      native_connected: false,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    prepared: true,
    ...fixture,
    token_created: false,
    native_connected: false,
  }),
);

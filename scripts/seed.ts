import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

if (!url || !serviceRole || !email) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ALLOWED_EMAIL no .env.local");
  process.exit(1);
}

const db = createClient(url, serviceRole, { auth: { persistSession: false } });

const areas = [
  {
    slug: "perfil",
    name: "Perfil",
    kind: "perfil",
    summary_md: [
      "# Quem sou",
      "",
      "- Cauã, dev full stack júnior.",
      "- Uso Claude e ChatGPT todos os dias, em projetos, trabalho, faculdade e cursos.",
      "",
      "# Como trabalhar comigo",
      "",
      "- Seja direto e prático; explique o porquê das decisões.",
      "- Edite este resumo pelo painel para manter atualizado.",
    ].join("\n"),
  },
  {
    slug: "preferencias",
    name: "Preferências",
    kind: "perfil",
    summary_md: [
      "- Responder em português do Brasil.",
      "- Código limpo, nomes claros, poucos comentários.",
      "- Antes de grandes mudanças, mostrar o plano curto.",
    ].join("\n"),
  },
  {
    slug: "inbox",
    name: "Inbox",
    kind: "pessoal",
    summary_md: "Destino padrão quando a IA não sabe onde salvar. Revise e mova os registros para a área certa.",
  },
];

async function main() {
  const member = await db.from("members").upsert({ email }, { onConflict: "email" });
  if (member.error) throw member.error;

  // O login não cria contas sozinho (cadastro fechado), então a conta do dono nasce aqui.
  const account = await db.auth.admin.createUser({ email, email_confirm: true });
  if (account.error && !/already|registered|exists/i.test(account.error.message)) throw account.error;

  const result = await db
    .from("areas")
    .upsert(areas.map((area) => ({ ...area, status: "ativo", updated_by: "manual" })), {
      onConflict: "slug",
      ignoreDuplicates: true,
    })
    .select("slug");
  if (result.error) throw result.error;

  console.log(`Membro liberado: ${email}`);
  console.log(`Áreas criadas: ${result.data.map((a) => a.slug).join(", ") || "nenhuma (já existiam)"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

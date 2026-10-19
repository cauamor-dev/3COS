import fs from "node:fs/promises";
import path from "node:path";
export const CENTRAL_SITE_ID = "2a7579a1-56dd-4e2d-a779-4b4457ae6e2f";
export async function centralHost() {
  const config = JSON.parse(
    await fs.readFile(
      path.join(process.env.APPDATA, "netlify", "Config", "config.json"),
      "utf8",
    ),
  );
  const token = config.users?.[config.userId]?.auth?.token;
  if (!token)
    throw new Error(
      "Autenticação local Netlify ausente. Nenhuma chave foi extraída do navegador.",
    );
  async function api(endpoint, method = "GET", body) {
    const r = await fetch(`https://api.netlify.com/api/v1/${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok)
      throw new Error(
        `Configuração da Central indisponível (${r.status}); resposta privada omitida.`,
      );
    return r.status === 204 ? null : r.json();
  }
  const site = await api(`sites/${CENTRAL_SITE_ID}`);
  if (site.name !== "central3c-caua" || site.account_slug !== "axial")
    throw new Error("O projeto não corresponde à Central autorizada.");
  const vars = await api(
    `accounts/${site.account_id}/env?site_id=${CENTRAL_SITE_ID}`,
  );
  const get = (key) => {
    const values = vars.find((v) => v.key === key)?.values ?? [];
    return (
      values.find((v) => v.context === "production")?.value ??
      values.find((v) => v.context === "all")?.value
    );
  };
  async function set(key, value) {
    if (
      !/^(CHLOE_(AI_ENABLED|FREE_TIER_CONFIRMED|EVALUATION_PASSED|EVALUATION_IDENTITY|PROVIDER|DAILY_CALLS|DAILY_TOKENS)|GROQ_MODEL_(FAST|SMART))$/.test(
        key,
      )
    )
      throw new Error("Variável fora da configuração não secreta da Chloe.");
    const previous = vars.find((v) => v.key === key);
    const values = (previous?.values ?? [])
      .filter((v) => v.context !== "all" && v.context !== "production")
      .map((v) => ({
        context: v.context,
        context_parameter: v.context_parameter,
        value: v.value,
      }));
    values.push({ context: "all", value });
    const item = {
      key,
      ...(previous?.scopes ? { scopes: previous.scopes } : {}),
      values,
    };
    await api(
      `accounts/${site.account_id}/env${previous ? `/${key}` : ""}?site_id=${CENTRAL_SITE_ID}`,
      previous ? "PUT" : "POST",
      previous ? item : [item],
    );
  }
  const metadata = (key) => {
    const item = vars.find((v) => v.key === key);
    return {
      present: !!item,
      secret: item?.is_secret === true,
      contexts: (item?.values ?? []).map((v) => v.context),
      scopes: item?.scopes ?? [],
    };
  };
  return { get, set, metadata };
}

// Connects a Telegram bot to the Central. Run it yourself: npm run telegram:setup
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const APP_URL = process.argv[2] ?? "https://central3c-caua.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const token = (await rl.question("Cole o token do bot (do @BotFather): ")).trim();
const api = async (method, body = {}) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
};

const me = await api("getMe");
console.log(`\nBot encontrado: @${me.username}`);
await api("deleteWebhook");
console.log(`Agora abra o Telegram, procure @${me.username} e mande qualquer mensagem (ex.: oi). Aguardando...`);

let chatId;
for (let i = 0; i < 60 && !chatId; i++) {
  const updates = await api("getUpdates", { timeout: 2 });
  chatId = updates.find((update) => update.message)?.message.chat.id;
  if (!chatId) await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!chatId) throw new Error("Não recebi mensagem em 2 minutos. Rode de novo.");
console.log(`Chat encontrado: ${chatId}`);

const secret = createHmac("sha256", env.MCP_SECRET).update("telegram").digest("base64url").slice(0, 32);
await api("setWebhook", {
  url: `${APP_URL}/api/telegram`,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});
await api("setMyCommands", {
  commands: [
    { command: "hoje", description: "Agenda e prazos de hoje" },
    { command: "semana", description: "Próximos 7 dias" },
    { command: "tarefas", description: "Tarefas pendentes" },
    { command: "nota", description: "Salvar uma nota" },
    { command: "tarefa", description: "Criar tarefa (com data, se quiser)" },
    { command: "buscar", description: "Buscar na Central" },
    { command: "ajuda", description: "Como usar" },
  ],
});
console.log("Webhook e comandos configurados.");

for (const [name, value] of [
  ["TELEGRAM_BOT_TOKEN", token],
  ["TELEGRAM_CHAT_ID", String(chatId)],
]) {
  const result = spawnSync("npx", ["vercel@64.1.0", "env", "add", name, "production", "--force", "--sensitive", "--yes"], {
    input: value,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  console.log(`${name} na Vercel: ${result.status === 0 ? "ok" : "falhou"}`);
  let local = readFileSync(".env.local", "utf8");
  const pattern = new RegExp(`^${name}=.*$`, "m");
  local = pattern.test(local) ? local.replace(pattern, `${name}=${value}`) : `${local.trimEnd()}\n${name}=${value}\n`;
  writeFileSync(".env.local", local);
}

console.log("Publicando a nova versão (1 a 2 minutos)...");
spawnSync("npx", ["vercel@64.1.0", "deploy", "--prod", "--yes"], { stdio: "inherit", shell: process.platform === "win32" });

await api("sendMessage", {
  chat_id: chatId,
  text: "3C OS conectado. Mande /ajuda para ver o que eu faço.",
});
console.log("\nPronto! Mande /ajuda para o bot.");
rl.close();

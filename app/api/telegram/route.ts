import { adminCentral } from "@/lib/central/server";
import { serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/http/auth";
import { derivedSecret } from "@/lib/http/derived-secret";
import { handleTelegramUpdate } from "@/lib/telegram/bot";

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_BOT_TOKEN || !safeEqual(secret, derivedSecret(serverEnv.mcpSecret, "telegram"))) {
    return new Response("Not found", { status: 404 });
  }
  try {
    await handleTelegramUpdate(await request.json(), adminCentral());
  } catch (error) {
    console.error("[telegram]", error);
  }
  // Always 200 so Telegram doesn't retry the same update forever.
  return Response.json({ ok: true });
}

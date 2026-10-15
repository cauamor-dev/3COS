import "server-only";
import { parseNaturalDate } from "@/lib/central/natural-date";
import type { CentralService } from "@/lib/central/service";
import { formatLocalTime } from "@/lib/central/time";
import { storeBytes } from "@/lib/files/server";
import { escapeHtml, sendTelegram, telegramApi, type InlineKeyboard } from "@/lib/notify/notifier";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    caption?: string;
    photo?: { file_id: string; file_size?: number }[];
    document?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number };
  };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
}

const HELP = [
  "<b>3C OS no Telegram</b>",
  "",
  "Mande qualquer texto: vira nota na inbox.",
  "Mande uma foto (com legenda, se quiser): fica salva na inbox com a imagem.",
  "Com data, vira lembrete: <i>me lembra amanhã às 9h de ligar pro Lott</i>",
  "",
  "/hoje: agenda e prazos de hoje",
  "/semana: próximos 7 dias",
  "/tarefas: pendentes, com botão para concluir",
  "/nota texto: salva uma nota",
  "/tarefa texto [data]: cria tarefa (com prazo se tiver data)",
  "/buscar termo: busca na Central",
].join("\n");

const short = (value: string, max = 60) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

export async function handleTelegramUpdate(update: TelegramUpdate, central: CentralService) {
  if (update.callback_query) return handleCallback(update.callback_query, central);

  const message = update.message;
  if (!message) return;
  const chatId = message.chat.id;
  const configured = process.env.TELEGRAM_CHAT_ID;

  if (!configured || String(chatId) !== configured) {
    // Unknown chats only learn their own ID, which the owner needs once during setup.
    if (message.text?.startsWith("/start")) {
      await sendTelegram(`Seu chat ID é <code>${chatId}</code>.`, { chatId });
    }
    return;
  }

  const isImageDocument = message.document?.mime_type?.startsWith("image/") || message.document?.mime_type === "application/pdf";
  if (message.photo?.length || isImageDocument) return capturePhoto(central, message);
  if (!message.text) return;

  const text = message.text.trim();
  const [command, ...rest] = text.split(/\s+/);
  const argument = rest.join(" ").trim();

  switch (command.split("@")[0].toLowerCase()) {
    case "/start":
    case "/ajuda":
    case "/help":
      return sendTelegram(HELP);
    case "/hoje": {
      const summary = await central.dailySummary();
      return sendTelegram(`<b>${escapeHtml(summary.title)}</b>\n\n${escapeHtml(summary.body)}`);
    }
    case "/semana":
      return sendWeek(central);
    case "/tarefas":
      return sendTasks(central);
    case "/buscar":
      return sendSearch(central, argument);
    case "/nota":
      return capture(central, argument, "nota");
    case "/tarefa":
      return capture(central, argument, "tarefa");
    default:
      return capture(central, text, "auto");
  }
}

async function capturePhoto(central: CentralService, message: NonNullable<TelegramUpdate["message"]>) {
  const fileId = message.photo?.at(-1)?.file_id ?? message.document!.file_id;
  const contentType = message.photo?.length ? "image/jpeg" : message.document!.mime_type!;
  try {
    const info = (await (await telegramApi("getFile", { file_id: fileId })).json()) as { result?: { file_path?: string } };
    if (!info.result?.file_path) throw new Error("arquivo indisponível");
    const file = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${info.result.file_path}`);
    if (!file.ok) throw new Error(`HTTP ${file.status}`);
    const url = await storeBytes(await file.arrayBuffer(), contentType);
    const caption = message.caption?.trim() ?? "";
    const isImage = contentType.startsWith("image/");
    const name = message.document?.file_name ?? (isImage ? "Foto" : "Arquivo");
    const { registro } = await central.saveEntry(
      {
        area_slug: "inbox",
        tipo: "nota",
        titulo: caption ? short(caption, 120) : isImage ? "Foto do Telegram" : name,
        conteudo: caption,
        ...(isImage && { imagem: url }),
        links: [{ url, titulo: name, ...(isImage && { imagem: url }) }],
      },
      "manual",
    );
    await sendTelegram(`${isImage ? "🖼️ Foto" : "📎 Arquivo"} salvo na inbox: <b>${escapeHtml(registro.titulo)}</b>`);
  } catch (error) {
    await sendTelegram(`Não consegui salvar o arquivo (${escapeHtml(error instanceof Error ? error.message : "erro")}). Até 10 MB, imagem ou PDF.`);
  }
}

async function capture(central: CentralService, raw: string, mode: "nota" | "tarefa" | "auto") {
  if (!raw) return sendTelegram("Escreva o texto depois do comando.");
  const parsed = parseNaturalDate(raw);
  const title = short(parsed.text || raw, 200);

  if (mode === "nota" || (mode === "auto" && !parsed.at)) {
    const { registro } = await central.saveEntry({ titulo: short(raw, 120), conteudo: raw, tipo: "nota", area_slug: "inbox" }, "manual");
    return sendTelegram(`📝 Salvo na inbox: <i>${escapeHtml(registro.titulo)}</i>`, { keyboard: undoKeyboard(registro.id) });
  }

  const { registro } = await central.saveEntry(
    {
      titulo: title,
      tipo: "tarefa",
      area_slug: "inbox",
      ...(parsed.at && { prazo: parsed.at, lembrar_em: parsed.at }),
    },
    "manual",
  );
  const when = parsed.at ? ` · ${new Date(parsed.at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "numeric", month: "short" })} ${formatLocalTime(parsed.at)}` : "";
  return sendTelegram(`⏰ Lembrete criado: <b>${escapeHtml(title)}</b>${when}`, { keyboard: undoKeyboard(registro.id) });
}

function undoKeyboard(id: string): InlineKeyboard {
  return [[{ text: "↩️ Desfazer", callback_data: `archive:${id}` }]];
}

async function sendWeek(central: CentralService) {
  const agenda = await central.agenda();
  const lines = [
    ...agenda.tarefas_atrasadas.map((task) => `🔴 Atrasada · ${escapeHtml(task.titulo)}`),
    ...agenda.eventos.map(
      (event) =>
        `📅 ${new Date(event.inicio).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "numeric" })} ${event.dia_inteiro ? "" : formatLocalTime(event.inicio)} · ${escapeHtml(event.titulo)}`,
    ),
    ...agenda.tarefas_no_periodo.map((task) => `☑️ ${task.prazo ? formatLocalTime(task.prazo) : ""} · ${escapeHtml(task.titulo)}`),
  ];
  return sendTelegram(lines.length ? `<b>Próximos 7 dias</b>\n\n${lines.join("\n")}` : "Semana livre por enquanto.");
}

async function sendTasks(central: CentralService) {
  const { tarefas } = await central.listTasks({ limite: 15 });
  if (tarefas.length === 0) return sendTelegram("Nada pendente. 🎉");
  const keyboard: InlineKeyboard = tarefas.map((task) => [{ text: `✅ ${short(task.titulo, 40)}`, callback_data: `done:${task.id}` }]);
  return sendTelegram(`<b>Tarefas pendentes</b> (toque para concluir)`, { keyboard });
}

async function sendSearch(central: CentralService, query: string) {
  if (!query) return sendTelegram("Use: /buscar termo");
  const result = await central.search({ consulta: query, limite: 5 });
  if (result.resultados.length === 0) return sendTelegram("Nada encontrado.");
  const lines = result.resultados.map(
    (item) => `• <b>${escapeHtml(item.titulo)}</b> <i>/${item.area}</i>\n${escapeHtml(short(item.conteudo.replace(/\s+/g, " "), 140))}`,
  );
  return sendTelegram(lines.join("\n\n"));
}

async function handleCallback(query: NonNullable<TelegramUpdate["callback_query"]>, central: CentralService) {
  const chatId = query.message?.chat.id;
  if (!chatId || String(chatId) !== process.env.TELEGRAM_CHAT_ID || !query.data) {
    return telegramApi("answerCallbackQuery", { callback_query_id: query.id });
  }
  const [action, id] = query.data.split(":");
  let answer = "Feito";
  try {
    if (action === "done") {
      await central.editEntry({ id, concluida: true }, "manual");
      answer = "Tarefa concluída ✅";
    } else if (action === "snooze") {
      await central.snoozeReminder(id, 60, "manual");
      answer = "Lembro de novo em 1 hora ⏰";
    } else if (action === "archive") {
      await central.editEntry({ id, arquivado: true }, "manual");
      answer = "Desfeito (arquivado)";
    }
  } catch {
    answer = "Não consegui. Tente pelo app.";
  }
  await telegramApi("answerCallbackQuery", { callback_query_id: query.id, text: answer });
  if (query.message) {
    await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } });
  }
  return undefined;
}


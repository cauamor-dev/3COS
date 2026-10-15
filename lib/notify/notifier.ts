import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

export interface Notification {
  title: string;
  body: string;
  /** Path inside the app opened when the notification is tapped. */
  path?: string;
  /** Optional richer version for e-mail. */
  html?: string;
  entryId?: string;
  kind?: string;
}

export interface ChannelResult {
  channel: "push" | "email" | "telegram";
  ok: boolean;
  detail?: string;
}

export type InlineKeyboard = { text: string; callback_data?: string; url?: string }[][];

export function enabledChannels() {
  return {
    push: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    email: !!process.env.RESEND_API_KEY,
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  };
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendPush(notification: Notification): Promise<ChannelResult> {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? `mailto:${serverEnv.allowedEmail}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const db = createAdminClient();
  const { data, error } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (error) return { channel: "push", ok: false, detail: error.message };
  if (!data?.length) return { channel: "push", ok: false, detail: "nenhum dispositivo" };

  const payload = JSON.stringify({ title: notification.title, body: notification.body, url: notification.path ?? "/" });
  const results = await Promise.allSettled(
    data.map((sub) => webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)),
  );

  // Subscriptions the browser revoked answer 404/410; drop them so they stop failing.
  const gone = data.filter((_, i) => {
    const result = results[i];
    return result.status === "rejected" && [404, 410].includes((result.reason as { statusCode?: number }).statusCode ?? 0);
  });
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone.map((sub) => sub.id));

  const delivered = results.filter((r) => r.status === "fulfilled").length;
  return { channel: "push", ok: delivered > 0, detail: `${delivered}/${data.length} dispositivos` };
}

async function sendEmail(notification: Notification): Promise<ChannelResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Central 3C <onboarding@resend.dev>",
      to: [process.env.NOTIFY_EMAIL ?? serverEnv.allowedEmail],
      subject: notification.title,
      text: `${notification.body}\n\n${serverEnv.appUrl}${notification.path ?? "/"}`,
      ...(notification.html && { html: notification.html }),
    }),
  });
  return { channel: "email", ok: response.ok, detail: response.ok ? undefined : await response.text() };
}

export async function telegramApi(method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response;
}

export async function sendTelegram(
  text: string,
  options: { chatId?: string | number; keyboard?: InlineKeyboard } = {},
): Promise<ChannelResult> {
  const response = await telegramApi("sendMessage", {
    chat_id: options.chatId ?? process.env.TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(options.keyboard && { reply_markup: { inline_keyboard: options.keyboard } }),
  });
  return { channel: "telegram", ok: response.ok, detail: response.ok ? undefined : await response.text() };
}

function reminderKeyboard(notification: Notification): InlineKeyboard | undefined {
  if (!notification.entryId) return undefined;
  return [
    [
      ...(notification.kind === "tarefa" ? [{ text: "✅ Concluir", callback_data: `done:${notification.entryId}` }] : []),
      { text: "⏰ Adiar 1h", callback_data: `snooze:${notification.entryId}` },
    ],
  ];
}

export async function notify(notification: Notification, only?: ChannelResult["channel"][]): Promise<ChannelResult[]> {
  const channels = enabledChannels();
  const wants = (channel: ChannelResult["channel"]) => channels[channel] && (!only || only.includes(channel));
  const tasks: Promise<ChannelResult>[] = [];

  if (wants("push")) tasks.push(sendPush(notification));
  if (wants("email")) tasks.push(sendEmail(notification));
  if (wants("telegram")) {
    const link = `${serverEnv.appUrl}${notification.path ?? "/"}`;
    tasks.push(
      sendTelegram(`<b>${escapeHtml(notification.title)}</b>\n${escapeHtml(notification.body)}\n\n<a href="${link}">Abrir na Central</a>`, {
        keyboard: reminderKeyboard(notification),
      }),
    );
  }

  const settled = await Promise.allSettled(tasks);
  return settled.map((result) =>
    result.status === "fulfilled" ? result.value : { channel: "push" as const, ok: false, detail: String(result.reason) },
  );
}

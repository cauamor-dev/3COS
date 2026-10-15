"use server";

import { refresh } from "next/cache";
import { getMember } from "@/lib/auth";
import { describeError } from "@/lib/central/format-error";
import { notify } from "@/lib/notify/notifier";
import type {
  CreateAreaInput,
  EditEntryInput,
  ImportInput,
  SaveEntryInput,
  UpdateAreaMetaInput,
  UpdateSummaryInput,
} from "@/lib/central/schemas";
import type { CentralService } from "@/lib/central/service";
import type { Area, Entry } from "@/lib/central/types";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(task: (central: CentralService) => Promise<T>, { refreshPage = true } = {}): Promise<ActionResult<T>> {
  const member = await getMember();
  if (!member) return { ok: false, error: "Sessão expirada. Entre novamente." };
  try {
    const data = await task(member.central);
    if (refreshPage) refresh();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: describeError(error).message };
  }
}

export async function saveEntryAction(input: SaveEntryInput) {
  return run(async (central) => (await central.saveEntry(input, "manual")).registro);
}

export async function editEntryAction(input: EditEntryInput) {
  return run(async (central) => {
    await central.editEntry(input, "manual");
  });
}

export async function updateSummaryAction(input: UpdateSummaryInput) {
  return run(async (central) => {
    await central.updateSummary(input, "manual");
  });
}

export async function createAreaAction(input: CreateAreaInput) {
  return run((central) => central.createArea(input, "manual"));
}

export async function updateAreaMetaAction(input: UpdateAreaMetaInput) {
  return run((central) => central.updateAreaMeta(input, "manual"));
}

export async function restoreVersionAction(versionId: string) {
  return run((central) => central.restoreVersion(versionId, "manual"));
}

export async function importAction(input: ImportInput) {
  return run((central) => central.importFiles(input, "manual"));
}

export async function getEntryAction(id: string): Promise<ActionResult<Entry>> {
  return run((central) => central.getEntry(id), { refreshPage: false });
}

export async function getAreaAction(slug: string): Promise<ActionResult<Area>> {
  return run((central) => central.getArea(slug), { refreshPage: false });
}

export async function searchAction(query: string): Promise<ActionResult<Entry[]>> {
  if (!query.trim()) return { ok: true, data: [] };
  return run(async (central) => (await central.searchEntries(query, { limit: 8 })).items, { refreshPage: false });
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export async function subscribePushAction(subscription: PushSubscriptionInput): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const { error } = await member.supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: subscription.userAgent?.slice(0, 200) ?? null,
    },
    { onConflict: "endpoint" },
  );
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionResult> {
  const member = await getMember();
  if (!member) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const { error } = await member.supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function testNotificationAction(): Promise<ActionResult<string>> {
  const member = await getMember();
  if (!member) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const results = await notify({ title: "Central 3C", body: "Notificações funcionando. Os lembretes chegam aqui.", path: "/" });
  if (results.length === 0) return { ok: false, error: "Nenhum canal configurado." };
  return { ok: true, data: results.map((r) => `${r.channel}: ${r.ok ? "ok" : "falhou"}${r.detail ? ` (${r.detail})` : ""}`).join(" · ") };
}

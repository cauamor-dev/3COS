"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import { getMember } from "@/lib/auth";
import { isDemo } from "@/lib/central/demo";
import { checked } from "@/lib/team/service";
import { describeError } from "@/lib/central/format-error";
import {
  preferencesInput,
  DEFAULT_PREFERENCES,
} from "@/lib/notify/preferences";

export async function notificationInboxAction(before?: string) {
  const m = await getMember();
  if (!m) return { ok: false as const, error: "Sessão expirada." };
  if (isDemo())
    return {
      ok: true as const,
      data: { items: [], unread: 0, preferences: DEFAULT_PREFERENCES },
    };
  try {
    const owner = m.central.actor.userId!;
    let q = m.supabase
      .from("notifications")
      .select("id,kind,title,body,path,entry_id,created_at,read_at,push_status")
      .eq("owner_id", owner)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(30);
    if (before) {
      const cursor = z
        .object({ at: z.iso.datetime({ offset: true }), id: z.uuid() })
        .parse(JSON.parse(before));
      q = q.or(
        `created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`,
      );
    }
    const [rows, count, p] = await Promise.all([
      q,
      m.supabase
        .from("notifications")
        .select("id", { head: true, count: "exact" })
        .eq("owner_id", owner)
        .is("read_at", null),
      m.supabase
        .from("notification_preferences")
        .select("in_app,push,kinds,quiet_start,quiet_end,lead_minutes")
        .eq("owner_id", owner)
        .maybeSingle(),
    ]);
    return {
      ok: true as const,
      data: {
        items: checked(rows),
        unread: count.count ?? 0,
        preferences: p.data
          ? preferencesInput.parse(p.data)
          : DEFAULT_PREFERENCES,
      },
    };
  } catch (e) {
    return { ok: false as const, error: describeError(e).message };
  }
}
export async function markNotificationsAction(ids: string[]) {
  const m = await getMember();
  if (!m || isDemo())
    return { ok: false as const, error: "Entre para alterar avisos." };
  try {
    const parsed = z.array(z.uuid()).min(1).max(30).parse(ids);
    checked(
      await m.supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", parsed)
        .eq("owner_id", m.central.actor.userId),
    );
    refresh();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: describeError(e).message };
  }
}
export async function saveNotificationPreferencesAction(raw: unknown) {
  const m = await getMember();
  if (!m || isDemo())
    return { ok: false as const, error: "Entre para configurar avisos." };
  try {
    const input = preferencesInput.parse(raw);
    checked(
      await m.supabase
        .from("notification_preferences")
        .upsert({
          ...input,
          owner_id: m.central.actor.userId,
          updated_at: new Date().toISOString(),
        }),
    );
    refresh();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: describeError(e).message };
  }
}
export async function setPushEnabledAction(enabled: boolean) {
  const m = await getMember();
  if (!m || isDemo())
    return { ok: false as const, error: "Entre para configurar push." };
  try {
    checked(
      await m.supabase
        .from("notification_preferences")
        .upsert(
          { owner_id: m.central.actor.userId },
          { onConflict: "owner_id", ignoreDuplicates: true },
        ),
    );
    checked(
      await m.supabase
        .from("notification_preferences")
        .update({ push: z.boolean().parse(enabled) })
        .eq("owner_id", m.central.actor.userId),
    );
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: describeError(e).message };
  }
}
export async function notificationCountAction() {
  const m = await getMember();
  if (!m || isDemo()) return 0;
  const r = await m.supabase
    .from("notifications")
    .select("id", { head: true, count: "exact" })
    .eq("owner_id", m.central.actor.userId)
    .is("read_at", null);
  return r.error ? 0 : (r.count ?? 0);
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOwnerPush } from "./notifier";
import { checked } from "@/lib/team/service";

/** The existing five-minute cron produces durable owner-only notices, then sends bounded push. */
export async function notificationTick() {
  const db = createAdminClient();
  const reminders = checked(await db.rpc("collect_notifications"));
  const notices = checked(await db.rpc("claim_notification_push")) as {
    id: string;
    owner_id: string;
    push_claim: string;
    path: string;
  }[];
  let sent = 0;
  for (const n of notices) {
    let status = "uncertain",
      detail = "Sem confirmação; confira a caixa da Central.";
    try {
      const result = await sendOwnerPush(
        {
          title: "3C OS",
          body: "Você tem um aviso na Central. Abra para consultar.",
          path: n.path,
        },
        n.owner_id,
      );
      status = result.ok
        ? "sent"
        : result.detail === "nenhum dispositivo"
          ? "failed"
          : "uncertain";
      detail = result.ok
        ? "Aceito pelo serviço push; leitura não confirmada."
        : "Push sem confirmação. O aviso permanece na Central.";
      if (result.ok) sent++;
    } catch {
      /* Unknown transport outcome is never retried automatically. */
    }
    checked(
      await db
        .from("notifications")
        .update({ push_status: status, push_detail: detail })
        .eq("id", n.id)
        .eq("push_claim", n.push_claim)
        .eq("push_status", "sending"),
    );
  }
  return { reminders, push_sent: sent, push_claimed: notices.length };
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCentral } from "@/lib/central/server";
import { CHLOE_ACTOR } from "@/lib/central/access";
import { sharedReviewWorks } from "./review";
import { checked } from "@/lib/team/service";
export async function dispatchOnce() {
  if (process.env.CENTRAL_DISPATCHER_ENABLED !== "1")
    return { status: "disabled", processed: 0 };
  const db = createAdminClient();
  const central = adminCentral(CHLOE_ACTOR);
  const control = checked(
    await db.from("execution_control").select("paused").eq("id", true).single(),
  );
  if (control.paused) return { status: "paused", processed: 0 };
  const agent = checked(
    await db.from("agents").select("id").eq("handle", "chloe").single(),
  );
  const areas = await central.listAllAreas();
  const runs = checked(
    await db.rpc("claim_work", {
      p_client: "central-dispatcher",
      p_agent: agent.id,
      p_areas: areas.map((a) => a.id),
      p_provider: "central",
      p_workflows: ["capture", "weekly_review"],
    }),
  );
  const run = (
    runs as {
      id: string;
      entry_id: string;
      lease_token: string;
      fencing_token: number;
    }[]
  )[0];
  if (!run) return { status: "idle", processed: 0 };
  const work = checked(
    await db
      .from("work_items")
      .select("workflow_key,objective")
      .eq("entry_id", run.entry_id)
      .single(),
  );
  try {
    let summary: string;
    if (work.workflow_key === "weekly_review") {
      // The service-role connection bypasses RLS: filter the joined entry before
      // limits and aggregation, using Chloe's shared-only visibility.
      const [done, blocked, usage] = await Promise.all([
        sharedReviewWorks(db)
          .eq("status", "delivered")
          .gte("updated_at", new Date(Date.now() - 7 * 86400000).toISOString())
          .limit(10),
        sharedReviewWorks(db)
          .in("status", ["blocked", "waiting_executor", "waiting_approval"])
          .limit(3),
        db
          .from("usage_daily")
          .select("provider,calls,used_tokens")
          .gte(
            "day",
            new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
          ),
      ]);
      const delivered = checked(done);
      const impediments = checked(blocked);
      const consumption = checked(usage);
      summary = `Revisão semanal de dados compartilhados registrados.\nEntregas: ${delivered.map((w) => w.objective).join("; ") || "nenhuma comprovada"}.\nPróximos três passos/impedimentos: ${impediments.map((w) => `${w.objective}: ${w.current_step}`).join("; ") || "nenhum registrado"}.\nConsumo local estimado: ${consumption.reduce((n, u) => n + u.calls, 0)} chamadas. Conexões não verificadas não são consideradas execuções.`;
    } else
      summary = `Captura preservada: ${work.objective}. Organização assistida fica disponível pelo registro; nenhuma alteração em lote ou chamada de IA foi realizada.`;
    const note = await central.saveEntry(
      {
        area_slug: "inbox",
        tipo: "progresso",
        titulo:
          work.workflow_key === "weekly_review"
            ? "Revisão semanal da Central"
            : "Captura organizada",
        conteudo: summary,
        links: [
          {
            url: `${process.env.NEXT_PUBLIC_APP_URL}/registros/${run.entry_id}`,
            titulo: "Trabalho de origem",
          },
        ],
      },
      "chloe",
    );
    checked(
      await db.rpc("report_work", {
        p_run: run.id,
        p_client: "central-dispatcher",
        p_lease: run.lease_token,
        p_fence: run.fencing_token,
        p_status: "delivered",
        p_result: {
          summary,
          evidence: [
            {
              url: `${process.env.NEXT_PUBLIC_APP_URL}/registros/${note.registro.id}`,
              title: "Registro da entrega",
            },
          ],
        },
      }),
    );
    return { status: "processed", processed: 1 };
  } catch {
    await db.rpc("report_work", {
      p_run: run.id,
      p_client: "central-dispatcher",
      p_lease: run.lease_token,
      p_fence: run.fencing_token,
      p_status: "blocked",
      p_result: {
        summary:
          "Etapa interrompida. Confira o registro antes de retomar; nenhum efeito externo foi repetido.",
        evidence: [],
      },
    });
    return { status: "blocked", processed: 0 };
  }
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { teamFor } from "./server";
import type { ActorContext } from "@/lib/central/access";
import type { TeamSnapshot } from "./types";
export async function teamSnapshot(
  actor: ActorContext,
  demo = false,
): Promise<TeamSnapshot> {
  const empty: TeamSnapshot = {
    agents: [],
    threads: [],
    works: [],
    connections: [],
    schedules: [],
    approvals: [],
    paused: true,
    artifacts: [],
    clients: [],
    demo,
  };
  if (demo)
    return {
      ...empty,
      error:
        "Demonstração sem conexões ou execuções externas. Os dados reais aparecem após login.",
    };
  try {
    const db = createAdminClient();
    const s = teamFor(actor);
    const [
      agents,
      threads,
      works,
      connections,
      schedules,
      approvals,
      control,
      artifacts,
      clients,
    ] = await Promise.all([
      db
        .from("agents")
        .select(
          "id,handle,name,platform,role,active,external_active,retired_at",
        )
        .is("retired_at", null)
        .order("name"),
      s.threads(),
      s.queue(),
      db
        .from("integration_status")
        .select(
          "provider,status,connection_mode,capabilities,last_success_at,activation_steps",
        ),
      db
        .from("automation_schedules")
        .select(
          "id,title,cadence,origin,active,verified_at,last_run_at,next_run_at,consumption,activation_steps",
        )
        .not("schedule_key", "like", "observed-grok-%"),
      db
        .from("action_approvals")
        .select("id,entry_id,status,target,payload_hash,payload_ref,expires_at")
        .order("created_at", { ascending: false })
        .limit(50),
      db.from("execution_control").select("paused").eq("id", true).single(),
      db
        .from("artifacts")
        .select("id,name,entry_id,mime")
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("integration_clients")
        .select("id,name,token_prefix,expires_at,revoked_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (
      [
        agents,
        connections,
        schedules,
        approvals,
        control,
        artifacts,
        clients,
      ].some((r) => r.error)
    )
      return {
        ...empty,
        error:
          "Equipe aguardando migrações ou conexão com o banco. A captura de notas permanece disponível.",
      };
    return {
      ...empty,
      agents: agents.data ?? [],
      threads,
      works,
      connections: connections.data ?? [],
      schedules: schedules.data ?? [],
      approvals: approvals.data ?? [],
      paused: control.data?.paused ?? true,
      artifacts: artifacts.data ?? [],
      clients: clients.data ?? [],
    };
  } catch {
    return {
      ...empty,
      error:
        "Não foi possível carregar a Equipe. Tente novamente; os registros existentes estão preservados.",
    };
  }
}

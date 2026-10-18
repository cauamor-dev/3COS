"use server";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { refresh } from "next/cache";
import { getMember } from "@/lib/auth";
import { teamFor } from "@/lib/team/server";
import { checked } from "@/lib/team/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeError } from "@/lib/central/format-error";
import { isDemo } from "@/lib/central/demo";
import { workInput } from "@/lib/work/contracts";
import type { TeamService } from "@/lib/team/service";
import type { ActionResult } from "./actions";
async function run<T>(
  fn: (s: TeamService) => Promise<T>,
  mutate = true,
): Promise<ActionResult<T>> {
  const m = await getMember();
  if (!m) return { ok: false, error: "Sessão expirada." };
  if (isDemo())
    return {
      ok: false,
      error: "Demonstração: esta ação não altera dados reais.",
    };
  try {
    const data = await fn(teamFor(m.central.actor));
    if (mutate) refresh();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: describeError(e).message };
  }
}
export async function createWorkAction(input: z.input<typeof workInput>) {
  return run((s) => s.createWork(input));
}
export async function teamMessagesAction(
  threadId: string,
  before?: string,
  beforeId?: string,
) {
  return run(
    (s) => s.messages({ thread_id: threadId, before, before_id: beforeId }),
    false,
  );
}
export async function postTeamMessageAction(input: unknown) {
  return run((s) =>
    s.postMessage(input as Parameters<TeamService["postMessage"]>[0]),
  );
}
export async function pauseTeamAction(paused: boolean) {
  return run((s) => s.pause(z.boolean().parse(paused)));
}
export async function decideApprovalAction(input: unknown) {
  return run((s) => s.decideApproval(input));
}
export async function decideApprovalsAction(input: unknown) {
  return run((s) => s.decideApprovals(input));
}
export async function workStateAction(input: unknown) {
  return run((s) => s.setWorkState(input));
}
export async function createThreadAction(input: unknown) {
  return run((s) => s.createThread(input));
}
export async function toggleAgentAction(raw: unknown) {
  const m = await getMember();
  if (!m || isDemo())
    return { ok: false as const, error: "Entre para configurar o executor." };
  try {
    const i = z.object({ id: z.uuid(), active: z.boolean() }).parse(raw);
    const db = createAdminClient();
    const a = checked(
      await db
        .from("agents")
        .select("platform,handle,retired_at")
        .eq("id", i.id)
        .single(),
    );
    if (
      a.retired_at ||
      a.platform === "human" ||
      (a.platform === "grok" && a.handle !== "clara")
    )
      return {
        ok: false as const,
        error: "Este agente usa a ponte Clara ou está fora da execução.",
      };
    if (i.active) {
      const clients = checked(
        await db
          .from("integration_clients")
          .select("id")
          .eq("agent_id", i.id)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .limit(1),
      );
      if (!clients.length)
        return {
          ok: false as const,
          error:
            "Configure primeiro o cliente individual. Habilitar não comprova conexão.",
        };
    }
    checked(
      await db.from("agents").update({ active: i.active }).eq("id", i.id),
    );
    refresh();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: describeError(e).message };
  }
}
export async function createClientAction(
  raw: unknown,
): Promise<ActionResult<{ token: string; id: string }>> {
  const m = await getMember();
  if (!m || !m.central.actor.userId)
    return { ok: false, error: "Proprietário autenticado necessário." };
  try {
    const i = z
      .object({
        name: z.string().min(1).max(80),
        agent_id: z.uuid(),
        areas: z.array(z.uuid()).min(1).max(30),
        execute: z.boolean().default(false),
      })
      .parse(raw);
    const allowed = await m.central.listAllAreas();
    if (i.areas.some((id) => !allowed.some((a) => a.id === id)))
      return { ok: false, error: "Área não autorizada." };
    const db = createAdminClient();
    const a = checked(
      await db
        .from("agents")
        .select("platform,handle,retired_at")
        .eq("id", i.agent_id)
        .single(),
    );
    if (a.retired_at || (a.platform === "grok" && a.handle !== "clara"))
      return {
        ok: false,
        error: "Somente Clara pode receber a conexão Grok da Central.",
      };
    if (
      !["claude", "chatgpt", "grok", "codex", "cursor", "opencode"].includes(
        a.platform,
      )
    )
      return { ok: false, error: "Agente não é uma conexão externa." };
    const token = `c3c_${randomBytes(32).toString("hex")}`;
    const client = checked(
      await db
        .from("integration_clients")
        .insert({
          name: i.name,
          owner_id: m.central.actor.userId,
          agent_id: i.agent_id,
          source: a.platform,
          token_hash: createHash("sha256").update(token).digest("hex"),
          token_prefix: token.slice(0, 12),
          expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
        })
        .select("id")
        .single(),
    );
    const grants = await db.from("client_area_grants").insert(
      i.areas.map((area_id) => ({
        client_id: client.id,
        area_id,
        operations: [
          "read",
          "write",
          "team",
          "files",
          ...(i.execute ? ["execute"] : []),
        ],
      })),
    );
    if (grants.error) {
      await db
        .from("integration_clients")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", client.id);
      throw new Error("Não foi possível conceder acesso; cliente revogado.");
    }
    await db
      .from("integration_status")
      .update({ status: "configured_unverified" })
      .eq("provider", a.platform)
      .neq("status", "verified");
    refresh();
    return { ok: true, data: { token, id: client.id } };
  } catch (e) {
    return { ok: false, error: describeError(e).message };
  }
}
export async function revokeClientAction(id: string) {
  const m = await getMember();
  if (!m || !m.central.actor.userId)
    return {
      ok: false as const,
      error: "Proprietário autenticado necessário.",
    };
  try {
    z.uuid().parse(id);
    checked(
      await createAdminClient()
        .from("integration_clients")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id),
    );
    refresh();
    return { ok: true as const, data: undefined };
  } catch (e) {
    return { ok: false as const, error: describeError(e).message };
  }
}

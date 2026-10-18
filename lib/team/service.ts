import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertArea, type ActorContext } from "@/lib/central/access";
import { CentralError } from "@/lib/central/errors";
import type { CentralService } from "@/lib/central/service";
import {
  approvalPayload,
  leaseInput,
  messageInput,
  reportInput,
  workInput,
  WORKFLOWS,
} from "@/lib/work/contracts";
import { payloadHash } from "@/lib/work/hash";
import { opportunityInput, importantMailInput } from "@/lib/career/contracts";

export function checked<T>(r: {
  data: T;
  error: { code?: string; message: string } | null;
}): NonNullable<T> {
  if (r.error) {
    if (r.error.code === "23505" || r.error.code === "40001")
      throw new CentralError(
        "conflict",
        "Operação repetida com conteúdo diferente ou versão/posse vencida.",
      );
    if (r.error.code === "42501")
      throw new CentralError(
        "forbidden",
        "Posse, aprovação ou permissão inválida.",
      );
    throw new CentralError(
      "invalid",
      "A operação não foi concluída. Confira o estado e os dados antes de tentar novamente.",
    );
  }
  return r.data as NonNullable<T>;
}
export class TeamService {
  constructor(
    private readonly db: SupabaseClient,
    readonly actor: ActorContext,
    private readonly central: CentralService,
  ) {}
  private human() {
    if (this.actor.kind !== "human" || !this.actor.userId)
      throw new CentralError(
        "forbidden",
        "Esta ação exige o proprietário autenticado.",
      );
  }
  private async entry(id: string, operation: "team" | "execute" = "team") {
    const e = await this.central.getEntry(id);
    assertArea(this.actor, e.area_id, operation);
    return e;
  }
  async createWork(raw: z.input<typeof workInput>) {
    const input = workInput.parse(raw);
    const area = await this.central.getArea(input.area_slug);
    assertArea(this.actor, area.id, "write");
    assertArea(this.actor, area.id, "team");
    const agent = checked(
      await this.db
        .from("agents")
        .select("id,handle,active,platform,retired_at")
        .eq("handle", input.assigned_agent)
        .single(),
    );
    if (agent.retired_at || agent.handle === "teo")
      throw new CentralError("invalid", "Este agente está fora da operação.");
    const executor =
      agent.platform === "grok"
        ? checked(
            await this.db
              .from("agents")
              .select("active,platform")
              .eq("handle", "clara")
              .single(),
          )
        : agent;
    for (const dependency of input.depends_on) {
      await this.entry(dependency);
      if (
        !checked(
          await this.db
            .from("work_items")
            .select("entry_id")
            .eq("entry_id", dependency)
            .maybeSingle(),
        )
      )
        throw new CentralError("invalid", "Dependência não é um trabalho.");
    }
    const params = {
      ...input,
      area_id: area.id,
      assigned_agent_id: agent.id,
      source: this.actor.source,
      agent_id: this.actor.agentId ?? null,
      owner_id: this.actor.userId ?? null,
      workflow_version: WORKFLOWS[input.workflow_key].version,
      current_step: WORKFLOWS[input.workflow_key].next,
      status:
        executor.active &&
        !["codex", "cursor", "opencode"].includes(executor.platform)
          ? "queued"
          : "waiting_executor",
    };
    const id = checked(
      await this.db.rpc("create_work_atomic", {
        p_client: this.actor.id,
        p_key: input.idempotency_key,
        p_hash: payloadHash(input),
        p_input: params,
      }),
    );
    return {
      entry_id: id,
      status: params.status,
      message:
        "Trabalho registrado. Sem acionamento externo comprovado; aguarda executor ou próxima rotina nativa.",
    };
  }
  async threads() {
    let q = this.db
      .from("team_threads")
      .select(
        "id,title,area_id,visibility,owner_id,entry_id,participants,created_at",
      )
      .order("created_at");
    if (this.actor.kind !== "human")
      q = q
        .eq("visibility", "shared")
        .in(
          "area_id",
          this.actor.grants
            ?.filter((g) => g.operations.includes("team"))
            .map((g) => g.areaId) ?? [],
        );
    else q = q.or(`visibility.eq.shared,owner_id.eq.${this.actor.userId}`);
    return checked(await q.limit(100));
  }
  async createThread(raw: unknown) {
    const i = z
      .object({
        title: z.string().min(1).max(200),
        area_slug: z.string().min(1),
        entry_id: z.uuid().optional(),
        participants: z.array(z.uuid()).max(15).default([]),
      })
      .parse(raw);
    const a = await this.central.getArea(i.area_slug);
    assertArea(this.actor, a.id, "team");
    if (i.entry_id) await this.entry(i.entry_id);
    if (i.participants.length) {
      const participants = checked(
        await this.db
          .from("agents")
          .select("id")
          .in("id", i.participants)
          .is("retired_at", null),
      );
      if (participants.length !== new Set(i.participants).size)
        throw new CentralError("invalid", "Participante indisponível.");
    }
    return checked(
      await this.db
        .from("team_threads")
        .insert({
          title: i.title,
          area_id: a.id,
          owner_id: this.actor.userId ?? null,
          entry_id: i.entry_id,
          participants: i.participants,
        })
        .select("id,title")
        .single(),
    );
  }
  private async thread(id: string) {
    z.uuid().parse(id);
    const t = (await this.threads()).find((t) => t.id === id);
    if (!t)
      throw new CentralError(
        "not_found",
        "Conversa não encontrada ou não autorizada.",
      );
    return t;
  }
  async messages(raw: unknown) {
    const i = z
      .object({
        thread_id: z.uuid(),
        before: z.iso.datetime({ offset: true }).optional(),
        before_id: z.uuid().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(30),
      })
      .parse(raw);
    await this.thread(i.thread_id);
    let q = this.db
      .from("team_messages")
      .select(
        "id,thread_id,actor_id,agent_id,source,body,reply_to,entry_id,origin_chat_title,origin_chat_url,refs,created_at",
      )
      .eq("thread_id", i.thread_id);
    if (i.before)
      q = i.before_id
        ? q.or(
            `created_at.lt.${i.before},and(created_at.eq.${i.before},id.lt.${i.before_id})`,
          )
        : q.lt("created_at", i.before);
    return checked(
      await q
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(i.limit),
    );
  }
  async postMessage(raw: z.input<typeof messageInput>) {
    const i = messageInput.parse(raw);
    const thread = await this.thread(i.thread_id);
    if (i.entry_id) {
      const entry = await this.entry(i.entry_id);
      if (thread.visibility === "shared" && entry.ai_access !== "shared")
        throw new CentralError(
          "forbidden",
          "Use uma conversa pessoal para vincular registro privado.",
        );
    }
    for (const id of i.artifact_ids) {
      const f = checked(
        await this.db
          .from("artifacts")
          .select("entry_id,visibility,status,owner_id")
          .eq("id", id)
          .single(),
      );
      if (
        f.status !== "ready" ||
        (thread.visibility === "shared" && f.visibility !== "shared")
      )
        throw new CentralError(
          "forbidden",
          "Este anexo não pode ser compartilhado nesta conversa.",
        );
      if (f.entry_id) {
        const entry = await this.entry(f.entry_id);
        assertArea(this.actor, entry.area_id, "files");
      } else if (
        this.actor.kind !== "human" ||
        f.owner_id !== this.actor.userId
      )
        throw new CentralError("forbidden", "Anexo não autorizado.");
    }
    if (i.reply_to) {
      const parent = checked(
        await this.db
          .from("team_messages")
          .select("thread_id")
          .eq("id", i.reply_to)
          .maybeSingle(),
      );
      if (parent?.thread_id !== i.thread_id)
        throw new CentralError(
          "invalid",
          "Resposta deve pertencer à mesma conversa.",
        );
    }
    const previous = checked(
      await this.db
        .from("team_messages")
        .select(
          "id,body,thread_id,refs,entry_id,reply_to,origin_chat_title,origin_chat_url",
        )
        .eq("actor_id", this.actor.id)
        .eq("idempotency_key", i.idempotency_key)
        .maybeSingle(),
    );
    if (previous) {
      if (
        previous.body !== i.body ||
        previous.thread_id !== i.thread_id ||
        JSON.stringify(previous.refs) !==
          JSON.stringify(
            i.artifact_ids.map((artifact_id) => ({ artifact_id })),
          ) ||
        (previous.entry_id ?? undefined) !== i.entry_id ||
        (previous.reply_to ?? undefined) !== i.reply_to ||
        (previous.origin_chat_title ?? undefined) !== i.origin_chat_title ||
        (previous.origin_chat_url ?? undefined) !== i.origin_chat_url
      )
        throw new CentralError(
          "conflict",
          "Chave reutilizada com outra mensagem.",
        );
    }
    const { artifact_ids, ...message } = i;
    const result =
      previous ??
      checked(
        await this.db
          .from("team_messages")
          .insert({
            ...message,
            refs: artifact_ids.map((artifact_id) => ({ artifact_id })),
            actor_id: this.actor.id,
            agent_id: this.actor.agentId ?? null,
            source: this.actor.source,
          })
          .select("id,body,created_at")
          .single(),
      );
    const deliveries = [];
    const handles = [
      ...new Set(
        [...i.body.matchAll(/(?:^|\s)@([a-z][a-z0-9_-]{1,59})\b/gi)].map((m) =>
          m[1].toLowerCase(),
        ),
      ),
    ].slice(0, 5);
    if (thread.visibility === "shared" && thread.area_id && handles.length) {
      const area = (await this.central.listAllAreas()).find(
        (a) => a.id === thread.area_id,
      );
      if (!area)
        throw new CentralError("forbidden", "Área da conversa não autorizada.");
      const recipients = checked(
        await this.db
          .from("agents")
          .select("handle")
          .in("handle", handles)
          .is("retired_at", null)
          .neq("handle", "teo"),
      );
      for (const recipient of recipients) {
        deliveries.push(
          await this.createWork({
            area_slug: area.slug,
            assigned_agent: recipient.handle,
            workflow_key: "message_delivery",
            objective: `Responder menção para @${recipient.handle} na conversa ${thread.title}`,
            expected_output: `Ler a mensagem ${result.id} na conversa ${thread.id} e responder com autoria real. Não realizar efeito externo.`,
            acceptance_criteria:
              "Resposta delimitada, com referência à mensagem e próximo passo; sem fingir acionamento externo.",
            idempotency_key: `mention-${result.id}-${recipient.handle}`,
          }),
        );
      }
    }
    return {
      ...result,
      deliveries,
      delivery_status: deliveries.length
        ? "Na fila para a próxima rotina; acionamento não confirmado."
        : null,
    };
  }
  async queue() {
    let q = this.db
      .from("work_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (this.actor.kind !== "human")
      q = q
        .or(
          `assigned_agent_id.eq.${this.actor.agentId ?? "00000000-0000-4000-8000-000000000000"},bridge_agent_id.eq.${this.actor.agentId ?? "00000000-0000-4000-8000-000000000000"}`,
        )
        .in(
          "area_id",
          this.actor.grants
            ?.filter((g) => g.operations.includes("execute"))
            .map((g) => g.areaId) ?? [],
        );
    const rows = checked(await q.limit(100));
    const visible = [];
    for (const row of rows) {
      try {
        await this.entry(row.entry_id);
        visible.push(row);
      } catch {
        /* No existence leak outside grants. */
      }
    }
    return visible;
  }
  async connections() {
    return checked(
      await this.db
        .from("integration_status")
        .select(
          "provider,status,connection_mode,capabilities,last_success_at,error_code,activation_steps",
        ),
    );
  }
  async agents() {
    return checked(
      await this.db
        .from("agents")
        .select("id,handle,name,platform,role,active,external_active")
        .is("retired_at", null),
    );
  }
  async approvals() {
    const works = await this.queue();
    if (!works.length) return [];
    return checked(
      await this.db
        .from("action_approvals")
        .select(
          "id,entry_id,status,target,payload_ref,payload_hash,expires_at,result_ref",
        )
        .in(
          "entry_id",
          works.map((w) => w.entry_id),
        )
        .order("created_at", { ascending: false })
        .limit(50),
    );
  }
  async claim(raw: unknown) {
    if (this.actor.kind !== "integration" || !this.actor.agentId)
      throw new CentralError(
        "forbidden",
        "Aquisição exige cliente executor individual.",
      );
    const i = z.object({ entry_id: z.uuid().optional() }).parse(raw);
    if (i.entry_id) await this.entry(i.entry_id, "execute");
    const agent = checked(
      await this.db
        .from("agents")
        .select("platform")
        .eq("id", this.actor.agentId)
        .single(),
    );
    return checked(
      await this.db.rpc("claim_work", {
        p_client: this.actor.id,
        p_agent: this.actor.agentId,
        p_areas:
          this.actor.grants
            ?.filter(
              (g) =>
                g.operations.includes("execute") &&
                g.operations.includes("read"),
            )
            .map((g) => g.areaId) ?? [],
        p_provider: agent.platform,
        p_entry: i.entry_id ?? null,
      }),
    );
  }
  async report(raw: z.input<typeof reportInput>) {
    const i = reportInput.parse(raw);
    const r = checked(
      await this.db
        .from("work_runs")
        .select("entry_id,executor_client_id")
        .eq("id", i.run_id)
        .single(),
    );
    await this.entry(r.entry_id, "execute");
    if (r.executor_client_id !== this.actor.id)
      throw new CentralError("forbidden", "Execução pertence a outro cliente.");
    return checked(
      await this.db.rpc("report_work", {
        p_run: i.run_id,
        p_client: this.actor.id,
        p_lease: i.lease_token,
        p_fence: i.fencing_token,
        p_status: i.status,
        p_result: i.result,
      }),
    );
  }
  async heartbeat(raw: unknown) {
    const i = leaseInput
      .extend({
        checkpoint: z
          .object({
            step: z.string().max(100),
            artifact_ids: z.array(z.uuid()).max(20).optional(),
          })
          .optional(),
      })
      .parse(raw);
    return checked(
      await this.db.rpc("heartbeat_work", {
        p_run: i.run_id,
        p_client: this.actor.id,
        p_lease: i.lease_token,
        p_fence: i.fencing_token,
        p_checkpoint: i.checkpoint ?? {},
      }),
    );
  }
  async requestApproval(raw: unknown) {
    const i = z
      .object({ entry_id: z.uuid(), payload: approvalPayload })
      .parse(raw);
    await this.entry(i.entry_id);
    for (const attachment of i.payload.attachments) {
      const file = checked(
        await this.db
          .from("artifacts")
          .select("entry_id,sha256,status")
          .eq("id", attachment.artifact_id)
          .single(),
      );
      if (
        file.entry_id !== i.entry_id ||
        file.status !== "ready" ||
        file.sha256 !== attachment.sha256 ||
        attachment.version !== 1
      )
        throw new CentralError(
          "invalid",
          "Anexo não corresponde ao arquivo verificado deste trabalho.",
        );
    }
    const hash = payloadHash(i.payload);
    const existing = checked(
      await this.db
        .from("action_approvals")
        .select("id,payload_hash,status")
        .eq("entry_id", i.entry_id)
        .eq("payload_hash", hash)
        .in("status", ["pending", "approved"])
        .maybeSingle(),
    );
    if (existing) return existing;
    return checked(
      await this.db
        .from("action_approvals")
        .insert({
          entry_id: i.entry_id,
          action_type: i.payload.action,
          target: i.payload.target,
          payload_hash: hash,
          payload_ref: i.payload,
          requested_by: this.actor.id,
        })
        .select("id,payload_hash,status")
        .single(),
    );
  }
  async decideApproval(raw: unknown) {
    this.human();
    const i = z
      .object({
        id: z.uuid(),
        payload_hash: z.string().length(64),
        approve: z.boolean(),
      })
      .parse(raw);
    const a = checked(
      await this.db
        .from("action_approvals")
        .select("entry_id,payload_ref,payload_hash,expires_at,status")
        .eq("id", i.id)
        .single(),
    );
    await this.entry(a.entry_id);
    if (
      a.payload_hash !== i.payload_hash ||
      payloadHash(a.payload_ref) !== i.payload_hash ||
      Date.parse(a.expires_at) <= Date.now() ||
      a.status !== "pending"
    )
      throw new CentralError(
        "conflict",
        "Proposta alterada, decidida ou vencida. Reabra o conteúdo atual.",
      );
    return checked(
      await this.db
        .from("action_approvals")
        .update({
          status: i.approve ? "approved" : "rejected",
          approved_by: this.actor.userId,
        })
        .eq("id", i.id)
        .eq("status", "pending")
        .select("id,status")
        .single(),
    );
  }
  async consumeApproval(raw: unknown) {
    const i = leaseInput
      .extend({ id: z.uuid(), payload: approvalPayload })
      .parse(raw);
    const a = checked(
      await this.db
        .from("action_approvals")
        .select("entry_id")
        .eq("id", i.id)
        .single(),
    );
    await this.entry(a.entry_id, "execute");
    const w = checked(
      await this.db
        .from("work_items")
        .select("assigned_agent_id,bridge_agent_id,allowed_actions,status")
        .eq("entry_id", a.entry_id)
        .single(),
    );
    if (
      (w.bridge_agent_id ?? w.assigned_agent_id) !== this.actor.agentId ||
      w.status === "cancelled"
    )
      throw new CentralError("forbidden", "Ação não pertence ao executor.");
    // Receipt reserves this exact content; it is never a proof of sending. Native connector approval still applies.
    return checked(
      await this.db.rpc("consume_approval_with_lease", {
        p_id: i.id,
        p_hash: payloadHash(i.payload),
        p_run: i.run_id,
        p_client: this.actor.id,
        p_lease: i.lease_token,
        p_fence: i.fencing_token,
      }),
    );
  }
  async decideApprovals(raw: unknown) {
    this.human();
    const i = z
      .object({
        items: z
          .array(
            z.object({
              id: z.uuid(),
              payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
            }),
          )
          .min(1)
          .max(20),
        approve: z.boolean(),
      })
      .parse(raw);
    if (new Set(i.items.map((a) => a.id)).size !== i.items.length)
      throw new CentralError("invalid", "Peça repetida na seleção.");
    return checked(
      await this.db.rpc("decide_approvals_batch", {
        p_owner: this.actor.userId,
        p_items: i.items,
        p_approve: i.approve,
      }),
    );
  }
  async pause(paused: boolean) {
    this.human();
    return checked(
      await this.db
        .from("execution_control")
        .update({ paused, updated_at: new Date().toISOString() })
        .eq("id", true)
        .select("paused")
        .single(),
    );
  }
  async setWorkState(raw: unknown) {
    this.human();
    const i = z
      .object({ entry_id: z.uuid(), status: z.enum(["queued", "cancelled"]) })
      .parse(raw);
    await this.entry(i.entry_id);
    if (i.status === "cancelled") {
      checked(await this.db.rpc("cancel_work", { p_entry: i.entry_id }));
      return { entry_id: i.entry_id, status: "cancelled" };
    }
    return checked(
      await this.db
        .from("work_items")
        .update({ status: i.status, available_at: new Date().toISOString() })
        .eq("entry_id", i.entry_id)
        .neq("status", "running")
        .select("entry_id,status")
        .single(),
    );
  }
  async saveOpportunity(raw: unknown) {
    const i = opportunityInput.parse(raw);
    if (!this.actor.userId)
      throw new CentralError(
        "forbidden",
        "Use um cliente individual pertencente ao proprietário.",
      );
    const area = await this.central.getArea(i.area_slug);
    assertArea(this.actor, area.id, "write");
    const existing = checked(
      await this.db
        .from("career_opportunities")
        .select("entry_id")
        .eq("owner_id", this.actor.userId)
        .eq("provider", this.actor.id)
        .eq("external_id", i.external_id)
        .maybeSingle(),
    );
    if (existing) return { entry_id: existing.entry_id, duplicate: true };
    const saved = await this.central.saveEntry(
      {
        area_slug: i.area_slug,
        tipo: "contexto",
        titulo: `${i.role} — ${i.company}`,
        conteudo: `Requisitos: ${i.requirements}\n\nAderência e lacunas: ${i.fit_explanation}\n\nPróxima ação: ${i.next_action}`,
        tags: ["vaga"],
        links: [{ url: i.url, titulo: i.company }],
        external_id: i.external_id,
      },
      this.actor.source,
    );
    const result = await this.db
      .from("career_opportunities")
      .insert({
        entry_id: saved.registro.id,
        owner_id: this.actor.userId,
        provider: this.actor.id,
        external_id: i.external_id,
        company: i.company,
        role: i.role,
        canonical_url: i.url,
        location: i.location,
        modality: i.modality,
        verified_at: i.verified_at,
        requirements: i.requirements,
        fit_explanation: i.fit_explanation,
        next_action: i.next_action,
      })
      .select("entry_id")
      .single();
    return checked(result);
  }
  async saveImportantMail(raw: unknown) {
    const i = importantMailInput.parse(raw);
    const area = await this.central.getArea(i.area_slug);
    assertArea(this.actor, area.id, "write");
    const found = await this.central.searchEntries(i.title, {
      area: i.area_slug,
      limit: 30,
    });
    const existing = found.items.find((e) => e.external_id === i.external_id);
    if (existing) return { entry_id: existing.id, duplicate: true };
    return this.central.saveEntry(
      {
        area_slug: i.area_slug,
        tipo: "nota",
        titulo: i.title,
        conteudo: i.summary,
        tags: ["email", "importante"],
        links: [{ url: i.url, titulo: "Abrir mensagem original" }],
        external_id: i.external_id,
        origin_chat_title: i.origin_chat_title,
      },
      this.actor.source,
    );
  }
}

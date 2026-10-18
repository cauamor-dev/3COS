"use server";

import { refresh } from "next/cache";
import { getMember } from "@/lib/auth";
import { describeError } from "@/lib/central/format-error";
import { WATCH_TAG } from "@/components/central/labels";
import type { SaveEntryInput } from "@/lib/central/schemas";
import { runChloe } from "@/lib/chloe/agent";
import { attachmentNote, type ChloeFiles } from "@/lib/chloe/attachment-note";
import { type Command, interpretCommand } from "@/lib/chloe/command";
import { chloeAvailable, pickTier, providerChat } from "@/lib/chloe/llm";
import type { ActionResult } from "./actions";
import { CHLOE_ACTOR } from "@/lib/central/access";
import { captureInput, captureNote } from "@/lib/chloe/capture";
import { teamFor } from "@/lib/team/server";
import { chloeStatus } from "@/lib/chloe/llm";
import type { ChatMessage } from "@/lib/chloe/llm";
import { teamRequestRoute } from "@/lib/chloe/team-routing";

export interface ChloeReply {
  reply: string;
  /** Lines of an agenda answer. */
  items?: string[];
  /** Entry created by the command, so the panel can offer "Desfazer". */
  undoId?: string;
  href?: string;
  duplicates?: { id: string; title: string }[];
  conversationId?: string;
  status?: string;
}

const TZ = "America/Sao_Paulo";
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const when = (iso: string) => `${day(iso)}, ${time(iso)}`;

/** Runs a quick request typed (or spoken) on the home command bar. */
async function executeChloeCommand(
  text: string,
  files?: ChloeFiles,
  options?: {
    mode?: "anotar" | "perguntar" | "equipe";
    conversationId?: string;
  },
  history?: ChatMessage[],
): Promise<ActionResult<ChloeReply>> {
  const member = await getMember();
  if (!member) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const central = member.central;
  const parsed = captureInput.safeParse({
    text: text || (files?.links?.length ? "Anexo" : ""),
    mode: options?.mode,
  });
  if (!parsed.success)
    return {
      ok: false,
      error:
        "Escreva até 50.000 caracteres; textos maiores devem ser anexados.",
    };
  const mode = parsed.data.mode;
  const explicitCommand =
    mode === "anotar" &&
    /^(me lembr[ae]|lembrete\s*:|(?:marca|marcar|agenda|agendar)\s|tarefa\s*:)/i.test(
      text.trim(),
    );

  if (mode === "anotar" && !explicitCommand && !files?.links?.length) {
    try {
      const saved = await captureNote(central, text);
      refresh();
      return {
        ok: true,
        data: {
          reply: "Anotação salva integralmente na inbox.",
          undoId: saved.registro.id,
          href: `/registros/${saved.registro.id}`,
          duplicates: saved.duplicates,
          status: chloeStatus().message,
        },
      };
    } catch (error) {
      return { ok: false, error: describeError(error).message };
    }
  }
  if (mode === "equipe") {
    try {
      const result = await teamFor(central.actor).createWork({
        area_slug: "inbox",
        objective: text,
        ...teamRequestRoute(text),
        expected_output:
          "Resposta ao pedido com fontes, entrega acessível e próximo passo. Responsável sugerido pelas palavras do pedido; ajuste na Equipe se necessário. Cauã constrói no Claude Code; QA após seu aviso.",
        acceptance_criteria:
          "Atender ao pedido preservado, declarar hipóteses e impedimentos; nenhuma ação externa sem autorização.",
        idempotency_key: crypto.randomUUID(),
      });
      refresh();
      return { ok: true, data: { reply: result.message, href: "/equipe" } };
    } catch (error) {
      const saved = await captureNote(central, text);
      refresh();
      return {
        ok: true,
        data: {
          reply:
            "Salvei sua anotação; a fila da equipe está indisponível. O encaminhamento ficou pendente.",
          href: `/registros/${saved.registro.id}`,
          status: describeError(error).message,
        },
      };
    }
  }

  // With files attached, everything goes to the inbox as a note (sorting by area comes later).
  if (files?.links?.length) {
    try {
      const entry = attachmentNote(text, files);
      const { registro } = await central.saveEntry(entry, "manual");
      refresh();
      return {
        ok: true,
        data: {
          reply: `Guardei na inbox: ${entry.titulo}.`,
          undoId: registro.id,
          href: `/registros/${registro.id}`,
        },
      };
    } catch (error) {
      return { ok: false, error: describeError(error).message };
    }
  }

  const command = interpretCommand(text);
  if (!command) return { ok: false, error: "Escreva o que você precisa." };

  // Rules first (instant, free); a model only for what they did not understand.
  if (mode === "perguntar" && chloeAvailable()) {
    try {
      const ai = central.asActor(CHLOE_ACTOR);
      const result = await runChloe(text, {
        central: ai,
        chat: providerChat,
        tier: pickTier(text),
        readOnly: true,
        history,
      });
      if (result.undoId) refresh();
      return {
        ok: true,
        data: {
          reply: result.reply,
          ...(result.undoId && {
            undoId: result.undoId,
            href: `/registros/${result.undoId}`,
          }),
        },
      };
    } catch {
      // Providers down or rate limited: fall through and keep the request as a note.
    }
  }

  try {
    if (mode === "perguntar" && command.kind !== "consulta") {
      const result = await central
        .asActor(CHLOE_ACTOR)
        .search({ consulta: text.slice(0, 180), limite: 5 });
      return {
        ok: true,
        data: {
          reply: result.total
            ? `Encontrei ${result.total} registros permitidos. Abra as fontes abaixo.`
            : "Não encontrei registros permitidos para esta pergunta. A IA está desativada; posso buscar por palavras.",
          items: result.resultados.map(
            (r) => `${r.titulo}: /registros/${r.id}`,
          ),
          status: chloeStatus().message,
        },
      };
    }
    if (command.kind === "consulta") {
      const agenda = await central.asActor(CHLOE_ACTOR).agenda({
        de: command.from,
        ate: command.to,
      });
      const items = [
        ...agenda.eventos.map(
          (e) => `${e.dia_inteiro ? "dia todo" : time(e.inicio)} · ${e.titulo}`,
        ),
        ...agenda.tarefas_no_periodo.map(
          (t) => `${t.prazo ? time(t.prazo) : "—"} · ☐ ${t.titulo}`,
        ),
      ];
      const late = agenda.tarefas_atrasadas.length;
      const lateNote = late
        ? ` E ${late === 1 ? "1 tarefa atrasada" : `${late} tarefas atrasadas`}.`
        : "";
      return {
        ok: true,
        data: {
          reply: items.length
            ? `Você tem ${items.length === 1 ? "1 item" : `${items.length} itens`} ${command.label}.${lateNote}`
            : `Nada marcado ${command.label}.${lateNote}`,
          items,
          href: "/agenda",
        },
      };
    }

    const fields = toEntry(command);
    const { registro } = await central.saveEntry(
      { ...fields, original_text: text, conteudo: fields.conteudo || text },
      "manual",
    );
    refresh();

    const reply =
      command.kind === "vigia"
        ? `Pedido salvo na fila para revisar: ${command.product}${command.target ? ` (alvo ${brl(command.target)})` : ""}. Rotina externa ainda não confirmada.`
        : command.kind === "evento"
          ? `Marquei na agenda: ${command.title} · ${command.allDay ? `${day(`${command.start}T12:00:00Z`)}, dia todo` : when(command.start)}.`
          : command.kind === "lembrete"
            ? `Combinado. Te lembro ${day(command.at!) === day(new Date().toISOString()) ? `às ${time(command.at!)}` : when(command.at!)}: ${command.title}.`
            : command.kind === "tarefa"
              ? `Tarefa criada: ${command.title}${command.at ? ` · prazo ${when(command.at)}` : ""}.`
              : command.kind === "ideia"
                ? `Ideia guardada na inbox: ${command.title}.`
                : `Anotado na inbox: ${command.title}.`;
    return {
      ok: true,
      data: { reply, undoId: registro.id, href: `/registros/${registro.id}` },
    };
  } catch (error) {
    return { ok: false, error: describeError(error).message };
  }
}

export async function chloeCommandAction(
  text: string,
  files?: ChloeFiles,
  options?: {
    mode?: "anotar" | "perguntar" | "equipe";
    conversationId?: string;
  },
): Promise<ActionResult<ChloeReply>> {
  const member = await getMember();
  if (!member) return { ok: false, error: "Sessão expirada. Entre novamente." };
  let conversationId: string | undefined;
  const history: ChatMessage[] = [];
  if (member.central.actor.userId) {
    if (
      options?.conversationId &&
      /^[0-9a-f-]{36}$/i.test(options.conversationId)
    ) {
      const c = await member.supabase
        .from("chloe_conversations")
        .select("id")
        .eq("id", options.conversationId)
        .eq("owner_id", member.central.actor.userId)
        .maybeSingle();
      conversationId = c.data?.id;
    }
    if (!conversationId) {
      const c = await member.supabase
        .from("chloe_conversations")
        .insert({ owner_id: member.central.actor.userId })
        .select("id")
        .single();
      conversationId = c.data?.id;
    }
    if (conversationId && options?.mode === "perguntar") {
      const previous = await member.supabase
        .from("chloe_messages")
        .select("role,content,entry_id")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(6);
      for (const msg of [...(previous.data ?? [])].reverse()) {
        if (msg.entry_id) {
          const permitted = await member.central
            .asActor(CHLOE_ACTOR)
            .getEntry(msg.entry_id)
            .catch(() => null);
          if (!permitted) continue;
        }
        history.push({
          role: msg.role as "user" | "assistant",
          content: msg.content.slice(0, 1500),
        });
      }
    }
  }
  const result = await executeChloeCommand(text, files, options, history);
  if (result.ok && conversationId) {
    const entryId = result.data.undoId ?? null;
    await member.supabase.from("chloe_messages").insert([
      {
        conversation_id: conversationId,
        role: "user",
        content: text.slice(0, 50000),
        entry_id: entryId,
      },
      {
        conversation_id: conversationId,
        role: "assistant",
        content: result.data.reply,
        entry_id: entryId,
      },
    ]);
    result.data.conversationId = conversationId;
  }
  return result;
}

function toEntry(
  command: Exclude<Command, { kind: "consulta" }>,
): SaveEntryInput {
  if (command.kind === "vigia") {
    return {
      area_slug: "inbox",
      tipo: "tarefa",
      titulo: `Vigiar preço: ${command.product}`,
      tags: [WATCH_TAG, "vega"],
      conteudo: [
        `Produto: ${command.product}`,
        `Preço-alvo: ${command.target ? brl(command.target) : "sem alvo; avisar em promoção real (abaixo do preço habitual)"}`,
        "",
        "Vega: pesquise o preço atual em lojas confiáveis, salve no Mural (tipo post) com link, imagem e preço,",
        "e use a tag alerta quando o preço bater o alvo. Conclua esta tarefa quando o Cauã comprar ou desistir.",
      ].join("\n"),
    };
  }
  const base = { area_slug: "inbox", titulo: command.title };
  switch (command.kind) {
    case "evento":
      return {
        ...base,
        tipo: "evento",
        inicio: command.start,
        ...(command.allDay && { dia_inteiro: true }),
      };
    case "lembrete":
    case "tarefa":
      return {
        ...base,
        tipo: "tarefa",
        ...(command.at && { prazo: command.at, lembrar_em: command.at }),
      };
    default:
      return { ...base, tipo: command.kind, conteudo: command.content };
  }
}

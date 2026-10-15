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

export interface ChloeReply {
  reply: string;
  /** Lines of an agenda answer. */
  items?: string[];
  /** Entry created by the command, so the panel can offer "Desfazer". */
  undoId?: string;
  href?: string;
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
export async function chloeCommandAction(
  text: string,
  files?: ChloeFiles,
): Promise<ActionResult<ChloeReply>> {
  const member = await getMember();
  if (!member) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const central = member.central;

  // With files attached, everything goes to the inbox as a note (sorting by area comes later).
  if (files?.links?.length) {
    try {
      const entry = attachmentNote(text, files);
      const { registro } = await central.saveEntry(entry, "manual");
      refresh();
      return {
        ok: true,
        data: { reply: `Guardei na inbox: ${entry.titulo}.`, undoId: registro.id, href: `/areas/inbox#${registro.id}` },
      };
    } catch (error) {
      return { ok: false, error: describeError(error).message };
    }
  }

  const command = interpretCommand(text.slice(0, 500));
  if (!command) return { ok: false, error: "Escreva o que você precisa." };

  // Rules first (instant, free); a model only for what they did not understand.
  if (command.kind === "nota" && command.guessed && chloeAvailable()) {
    try {
      const result = await runChloe(text.slice(0, 500), { central, chat: providerChat, tier: pickTier(text) });
      if (result.undoId) refresh();
      return { ok: true, data: { reply: result.reply, ...(result.undoId && { undoId: result.undoId, href: `/areas/inbox#${result.undoId}` }) } };
    } catch {
      // Providers down or rate limited: fall through and keep the request as a note.
    }
  }

  try {
    if (command.kind === "consulta") {
      const agenda = await central.agenda({
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

    const { registro } = await central.saveEntry(toEntry(command), "manual");
    refresh();

    const reply =
      command.kind === "vigia"
        ? `Combinado. Pedi para a Vega vigiar o preço: ${command.product}${command.target ? ` (alvo ${brl(command.target)})` : ""}. Te aviso quando aparecer promoção.`
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
      data: { reply, undoId: registro.id, href: `/areas/inbox#${registro.id}` },
    };
  } catch (error) {
    return { ok: false, error: describeError(error).message };
  }
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

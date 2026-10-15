"use server";

import { refresh } from "next/cache";
import { getMember } from "@/lib/auth";
import { describeError } from "@/lib/central/format-error";
import type { SaveEntryInput } from "@/lib/central/schemas";
import { type Command, interpretCommand } from "@/lib/chloe/command";
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
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const when = (iso: string) => `${day(iso)}, ${time(iso)}`;

/** Runs a quick request typed (or spoken) on the home command bar. */
export async function chloeCommandAction(text: string): Promise<ActionResult<ChloeReply>> {
  const member = await getMember();
  if (!member) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const command = interpretCommand(text.slice(0, 500));
  if (!command) return { ok: false, error: "Escreva o que você precisa." };
  const central = member.central;

  try {
    if (command.kind === "consulta") {
      const agenda = await central.agenda({ de: command.from, ate: command.to });
      const items = [
        ...agenda.eventos.map((e) => `${e.dia_inteiro ? "dia todo" : time(e.inicio)} · ${e.titulo}`),
        ...agenda.tarefas_no_periodo.map((t) => `${t.prazo ? time(t.prazo) : "—"} · ☐ ${t.titulo}`),
      ];
      const late = agenda.tarefas_atrasadas.length;
      const lateNote = late ? ` E ${late === 1 ? "1 tarefa atrasada" : `${late} tarefas atrasadas`}.` : "";
      return {
        ok: true,
        data: {
          reply: items.length ? `Você tem ${items.length === 1 ? "1 item" : `${items.length} itens`} ${command.label}.${lateNote}` : `Nada marcado ${command.label}.${lateNote}`,
          items,
          href: "/agenda",
        },
      };
    }

    const { registro } = await central.saveEntry(toEntry(command), "manual");
    refresh();

    const reply =
      command.kind === "evento"
        ? `Marquei na agenda: ${command.title} · ${command.allDay ? `${day(`${command.start}T12:00:00Z`)}, dia todo` : when(command.start)}.`
        : command.kind === "lembrete"
          ? `Combinado. Te lembro ${day(command.at!) === day(new Date().toISOString()) ? `às ${time(command.at!)}` : when(command.at!)}: ${command.title}.`
          : command.kind === "tarefa"
            ? `Tarefa criada: ${command.title}${command.at ? ` · prazo ${when(command.at)}` : ""}.`
            : command.kind === "ideia"
              ? `Ideia guardada na inbox: ${command.title}.`
              : `Anotado na inbox: ${command.title}.`;
    return { ok: true, data: { reply, undoId: registro.id, href: `/areas/inbox#${registro.id}` } };
  } catch (error) {
    return { ok: false, error: describeError(error).message };
  }
}

function toEntry(command: Exclude<Command, { kind: "consulta" }>): SaveEntryInput {
  const base = { area_slug: "inbox", titulo: command.title };
  switch (command.kind) {
    case "evento":
      return { ...base, tipo: "evento", inicio: command.start, ...(command.allDay && { dia_inteiro: true }) };
    case "lembrete":
    case "tarefa":
      return { ...base, tipo: "tarefa", ...(command.at && { prazo: command.at, lembrar_em: command.at }) };
    default:
      return { ...base, tipo: command.kind, conteudo: command.content };
  }
}

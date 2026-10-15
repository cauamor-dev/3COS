import { parseNaturalDate } from "@/lib/central/natural-date";

/**
 * Rule-based reading of a short pt-BR request ("me lembra daqui a pouco de X",
 * "dia 20 tenho prova às 19h", "anota ...", "o que tenho amanhã?"). Works without
 * any AI key; a model can take over the free-form cases later.
 */
export type Command =
  | { kind: "consulta"; from: string; to: string; label: string }
  | { kind: "nota" | "ideia"; title: string; content: string }
  | { kind: "lembrete" | "tarefa"; title: string; at: string | null }
  | { kind: "evento"; title: string; start: string; allDay: boolean };

const strip = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const QUERY = /^(o ?que|q|que|quais?|qual|como)\b.*\b(tenho|tem|ha|esta|fica)\b|\b(minha agenda|meus compromissos|minhas tarefas|meu dia)\b/;
const NOTE = /^(anota(r|e)?|nota|salva(r)?|salve|guarda(r)?|guarde|registra(r)?|registre)\b/;
const IDEA = /^(ideia|tive uma ideia)\b/;
const REMINDER = /\b(me lembr\w*|lembr(e|a|ar)(-me)?|lembrete|me avis\w*)\b/;
const EVENT = /\b(tenho|prova|reuniao|aula|consulta|evento|compromisso|marca(r)?|agenda(r)?|entrevista|apresentacao|jogo|festa|aniversario|viagem|dentista|medico|show|culto|treino)\b/;
const TASK = /^(preciso|tenho que|tarefa|fazer|comprar|pagar|ligar|enviar|mandar|estudar|terminar|entregar|resolver)\b/;

const LEADING = [
  /^(anota(r|e)?|nota|salva(r)?|salve|guarda(r)?|guarde|registra(r)?|registre)\b(\s+(ai|aí|isso|que|pra mim|para mim))*\s*[:,-]?\s*/i,
  /^(tive uma )?ideia\s*[:,-]?\s*(de\s+)?/i,
  /^(me )?(lembr\w*|avis\w*)(-me)?(\s+(de|que|pra|para))?\s*/i,
  /^lembrete\s*[:,-]?\s*(de\s+)?/i,
  /^(tarefa|preciso( de)?|tenho que)\s*[:,-]?\s*/i,
  /^(eu\s+)?tenho\s+(uma?\s+)?/i,
  /^(marca(r)?|agenda(r)?)\s+(uma?\s+)?/i,
];

function tidy(text: string) {
  let title = text.replace(/[?.!]+$/, "").replace(/\s{2,}/g, " ").trim();
  for (const pattern of LEADING) title = title.replace(pattern, "");
  title = title.replace(/^(de|que)\s+/i, "").trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function localDay(iso: string | number) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDaysKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function interpretCommand(input: string, now = new Date()): Command | null {
  const raw = input.trim();
  if (!raw) return null;
  const lower = strip(raw);

  if (QUERY.test(lower) && !NOTE.test(lower)) {
    const today = localDay(now.getTime());
    if (/\bsemana\b/.test(lower)) return { kind: "consulta", from: today, to: addDaysKey(today, 6), label: "nos próximos 7 dias" };
    const parsed = parseNaturalDate(raw, now);
    const day = parsed.at ? localDay(parsed.at) : today;
    const label = day === today ? "hoje" : day === addDaysKey(today, 1) ? "amanhã" : "nesse dia";
    return { kind: "consulta", from: day, to: day, label };
  }

  if (IDEA.test(lower)) return { kind: "ideia", title: short(tidy(raw)), content: raw };
  if (NOTE.test(lower)) return { kind: "nota", title: short(tidy(raw)), content: raw };

  const parsed = parseNaturalDate(raw, now);
  const title = short(tidy(parsed.text || raw));

  if (REMINDER.test(lower)) return parsed.at ? { kind: "lembrete", title, at: parsed.at } : { kind: "tarefa", title, at: null };
  if (parsed.at && EVENT.test(lower) && !TASK.test(lower)) {
    return { kind: "evento", title, start: parsed.hasTime ? parsed.at : localDay(parsed.at), allDay: !parsed.hasTime };
  }
  if (parsed.at || TASK.test(lower)) return { kind: "tarefa", title, at: parsed.at };
  return { kind: "nota", title: short(tidy(raw)), content: raw };
}

function short(text: string, max = 120) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

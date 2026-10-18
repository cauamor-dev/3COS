"use client";

import { cn } from "cn";
import { CalendarPlus, CheckSquare, MapPin, Repeat, ChevronLeft,ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState,useTransition } from "react";
import { loadAgendaRangeAction } from "@/app/(app)/agenda-actions";
import { editEntryAction } from "@/app/(app)/actions";
import { toast } from "sonner";
import { dayKey, dayLabel, formatTime } from "@/components/central/dates";
import { SOURCE_COLOR } from "@/components/central/labels";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import type { Entry } from "@/lib/central/types";

export interface AgendaItem {
  key: string;
  kind: "evento" | "tarefa";
  entry: Entry;
  start: string;
  end: string | null;
}

const STRIP_DAYS = 21;

export function AgendaView({ items, todayKey }: { items: AgendaItem[]; todayKey: string }) {
  const [view,setView]=useState<"lista"|"semana"|"mes">("lista");
  const [anchor,setAnchor]=useState(todayKey);
  const [loaded,setLoaded]=useState(items);
  const [pending,run]=useTransition();
  const now = useNow();
  const { openQuickEntry } = useCentral();
  const [selected, setSelected] = useState<string | null>(null);
  const currentToday = now === null ? todayKey : dayKey(now);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const item of loaded) {
      const key = dayKey(item.start);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [loaded]);

  const base=new Date(`${anchor}T12:00:00-03:00`);
  const monthStart=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),1,15));
  const gridStart=monthStart.getTime()-monthStart.getUTCDay()*86400000;
  const strip = Array.from({ length: view==="mes"?42:view==="semana"?7:STRIP_DAYS }, (_, i) => dayKey((view==="mes"?gridStart:base.getTime()) + i * 86_400_000));
  const days = [...byDay.keys()].filter((key) => (selected ? key === selected : view==="lista"? key >= anchor:strip.includes(key))).sort();
  function navigate(direction:number){
    const next=new Date(base);if(view==="mes"){next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+direction);}else next.setUTCDate(next.getUTCDate()+direction*(view==="semana"?7:21));
    const nextKey=dayKey(next);setAnchor(nextKey);setSelected(null);
    run(async()=>{const from=new Date(next);from.setUTCDate(1);from.setUTCDate(from.getUTCDate()-7);const to=new Date(next);to.setUTCMonth(to.getUTCMonth()+1);to.setUTCDate(8);const r=await loadAgendaRangeAction(from.toISOString(),to.toISOString());if(r.ok)setLoaded(r.data);else toast.error(r.error);});
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">{([['lista','Lista'],['semana','Semana'],['mes','Mês']] as const).map(([key,label])=><Button key={key} size="sm" variant={view===key?"secondary":"ghost"} onClick={()=>{setView(key);setSelected(null);}}>{label}</Button>)}<Button size="icon-sm" variant="outline" disabled={pending} aria-label="Período anterior" onClick={()=>navigate(-1)}><ChevronLeft /></Button><span className="text-sm">{base.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo",month:"long",year:"numeric"})}</span><Button size="icon-sm" variant="outline" disabled={pending} aria-label="Próximo período" onClick={()=>navigate(1)}><ChevronRight /></Button><Button size="sm" variant="ghost" onClick={()=>{setAnchor(currentToday);setLoaded(items);setSelected(currentToday);}}>Hoje</Button></div>
      <div className="flex items-center gap-2">
        <div className={view==="mes"?"grid min-w-0 flex-1 grid-cols-7 gap-1":"no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1"}>
          {strip.map((key) => {
            const count = byDay.get(key)?.length ?? 0;
            const date = new Date(`${key}T12:00:00-03:00`);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(selected === key ? null : key)}
                className={cn(
                  "glass flex shrink-0 flex-col items-center rounded-xl py-2 transition-colors duration-150",
                  view==="mes"?"min-w-0":"w-12",
                  key === currentToday && "border-primary/50",
                  selected === key && "bg-primary/20",
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  {date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).slice(0, 3)}
                </span>
                <span className="text-base font-medium">{date.getUTCDate()}</span>
                <span className={cn("mt-0.5 size-1.5 rounded-full", count ? "bg-lilac" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
        <Button size="sm" onClick={() => openQuickEntry({ type: "evento" })} className="shrink-0 self-start">
          <CalendarPlus /> Evento
        </Button>
      </div>

      {days.length === 0 ? (
        <p className="glass rounded-xl p-5 text-sm text-muted-foreground">
          {selected ? "Nada neste dia." : "Agenda livre nos próximos dias."} Peça para a Vega ou o Nox agendar algo, ou use o botão Evento.
        </p>
      ) : (
        days.map((key) => (
          <section key={key}>
            <h2 className={cn("label-mono mb-2", key === currentToday && "text-lilac")}>{dayLabel(key, currentToday)}</h2>
            <ul className="space-y-2">
              {byDay.get(key)!.map((item) => (
                <AgendaRow key={item.key} item={item} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const { entry } = item;
  const color = SOURCE_COLOR[entry.source];
  const isTask = item.kind === "tarefa";

  return (
    <li className="glass glass-hover flex gap-3 rounded-xl p-3">
      <div className="w-14 shrink-0 text-right font-mono text-xs leading-5 text-muted-foreground">
        {entry.all_day && !isTask ? "dia todo" : formatTime(item.start)}
        {item.end && !entry.all_day && <div className="opacity-60">{formatTime(item.end)}</div>}
      </div>
      <span className="w-0.5 shrink-0 rounded-full" style={{ background: isTask ? "var(--muted-foreground)" : color }} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {isTask && <CheckSquare className="size-3.5 text-muted-foreground" />}
          <Link href={`/registros/${entry.id}`} className="truncate hover:text-lilac">{entry.title}</Link>
          {entry.recurrence && <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="Repete" />}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-muted-foreground">
          <Link href={`/areas/${entry.area.slug}#${entry.id}`} className="hover:text-lilac">
            /{entry.area.slug}
          </Link>
          {entry.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" /> {entry.location}
            </span>
          )}
          {isTask && <span>prazo</span>}
          <Link href={`/registros/${entry.id}`} className="text-lilac">Editar / anexar</Link>
          <button type="button" className="hover:text-lilac" onClick={async()=>{const r=await editEntryAction({id:entry.id,revision:entry.revision,...(isTask?{concluida:!entry.done_at}:{arquivado:true})});if(!r.ok)toast.error(r.error);else toast.success(isTask?"Tarefa concluída":"Evento arquivado");}}>{isTask?"Concluir":"Arquivar"}</button>
        </div>
      </div>
    </li>
  );
}

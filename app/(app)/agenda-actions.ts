"use server";
import { getMember } from "@/lib/auth";
import type { AgendaItem } from "@/components/agenda/agenda-view";
import type { ActionResult } from "./actions";
export async function loadAgendaRangeAction(from:string,to:string):Promise<ActionResult<AgendaItem[]>> {
 const m=await getMember();if(!m)return {ok:false,error:"Sessão expirada."};
 const a=new Date(from),b=new Date(to);if(!Number.isFinite(a.getTime()+b.getTime())||b<=a||b.getTime()-a.getTime()>62*86400000)return {ok:false,error:"Período inválido (máximo 62 dias)."};
 try{const [events,tasks]=await Promise.all([m.central.eventsBetween(a,b),m.central.tasksForPanel()]);return {ok:true,data:[...events.map(e=>({key:`${e.entry.id}:${e.start}`,kind:"evento" as const,entry:e.entry,start:e.start,end:e.end})),...tasks.filter(t=>t.due_at&&!t.done_at&&t.due_at>=from&&t.due_at<=to).map(t=>({key:t.id,kind:"tarefa" as const,entry:t,start:t.due_at!,end:null}))]};}catch{return {ok:false,error:"Não foi possível carregar este período."};}
}

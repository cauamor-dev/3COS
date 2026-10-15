"use client";

import { cn } from "cn";
import { Bell, Check, ChevronDown, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { editEntryAction, saveEntryAction } from "@/app/(app)/actions";
import { dayKey, dayLabel, formatDateTime, formatTime, fromLocalInput } from "@/components/central/dates";
import { SourceDot } from "@/components/central/source-badge";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNow } from "@/hooks/use-now";
import { WATCH_TAG } from "@/components/central/labels";
import type { Entry } from "@/lib/central/types";

type Group = { id: string; label: string; tasks: Entry[]; tone?: "danger" };

export function TaskBoard({ tasks, serverNow }: { tasks: Entry[]; serverNow: number }) {
  const now = useNow() ?? serverNow;
  const [showDone, setShowDone] = useState(false);
  const [optimistic, toggleOptimistic] = useOptimistic(tasks, (current, id: string) =>
    current.map((task) => (task.id === id ? { ...task, done_at: task.done_at ? null : new Date().toISOString() } : task)),
  );
  const [, startTransition] = useTransition();

  const groups = useMemo<Group[]>(() => {
    const reference = now;
    const today = dayKey(reference);
    const weekAhead = dayKey(reference + 7 * 86_400_000);
    const pending = optimistic.filter((task) => !task.done_at);
    const withDue = pending.filter((task) => task.due_at).sort((a, b) => a.due_at!.localeCompare(b.due_at!));
    return [
      { id: "late", label: "Atrasadas", tasks: withDue.filter((t) => new Date(t.due_at!).getTime() < reference), tone: "danger" as const },
      { id: "today", label: "Hoje", tasks: withDue.filter((t) => new Date(t.due_at!).getTime() >= reference && dayKey(t.due_at!) === today) },
      { id: "week", label: "Próximos 7 dias", tasks: withDue.filter((t) => dayKey(t.due_at!) > today && dayKey(t.due_at!) <= weekAhead) },
      { id: "later", label: "Depois", tasks: withDue.filter((t) => dayKey(t.due_at!) > weekAhead) },
      { id: "nodate", label: "Sem prazo", tasks: pending.filter((t) => !t.due_at && !t.tags.includes(WATCH_TAG)) },
      { id: "watch", label: "Vigias de preço", tasks: pending.filter((t) => !t.due_at && t.tags.includes(WATCH_TAG)) },
    ].filter((group) => group.tasks.length > 0);
  }, [optimistic, now]);

  const done = optimistic
    .filter((task) => task.done_at)
    .sort((a, b) => b.done_at!.localeCompare(a.done_at!))
    .slice(0, 30);

  function toggle(task: Entry) {
    startTransition(async () => {
      toggleOptimistic(task.id);
      const result = await editEntryAction({ id: task.id, concluida: !task.done_at });
      if (!result.ok) toast.error(result.error);
      else if (!task.done_at) toast.success("Tarefa concluída");
    });
  }

  return (
    <div className="space-y-6">
      <QuickAddTask />
      {groups.length === 0 && (
        <p className="glass rounded-xl p-5 text-sm text-muted-foreground">
          Nada pendente. Peça para a Vega ou o Nox criar tarefas, ou adicione acima.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.id}>
          <h2 className={cn("label-mono mb-2", group.tone === "danger" && "text-destructive")}>
            {group.label} · {group.tasks.length}
          </h2>
          <ul className="glass divide-y divide-white/5 overflow-hidden rounded-xl">
            {group.tasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} now={now} />
            ))}
          </ul>
        </section>
      ))}
      {done.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            className="label-mono mb-2 flex items-center gap-1 hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform duration-150", !showDone && "-rotate-90")} />
            Concluídas · {done.length}
          </button>
          {showDone && (
            <ul className="glass divide-y divide-white/5 overflow-hidden rounded-xl opacity-70">
              {done.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={() => toggle(task)} now={now} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, now }: { task: Entry; onToggle(): void; now: number }) {
  const doneTask = !!task.done_at;
  const late = !doneTask && task.due_at && new Date(task.due_at).getTime() < now;

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-label={doneTask ? "Reabrir tarefa" : "Concluir tarefa"}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors duration-150",
          doneTask ? "border-primary bg-primary text-primary-foreground" : "border-white/25 hover:border-primary",
        )}
      >
        {doneTask && <Check className="size-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug", doneTask && "text-muted-foreground line-through")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <Link href={`/areas/${task.area.slug}#${task.id}`} className="hover:text-lilac">
            /{task.area.slug}
          </Link>
          {task.due_at && (
            <span className={cn(late && "text-destructive")}>
              {`${dayLabel(dayKey(task.due_at), dayKey(now))} ${formatTime(task.due_at)}`}
            </span>
          )}
          {task.remind_at && !task.reminded_at && (
            <span className="flex items-center gap-1">
              <Bell className="size-3" /> {formatDateTime(task.remind_at)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <SourceDot source={task.source} />
          </span>
        </div>
      </div>
    </li>
  );
}

function QuickAddTask() {
  const { areas } = useCentral();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [pending, startTransition] = useTransition();
  const inbox = areas.find((area) => area.slug === "inbox")?.slug ?? "inbox";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await saveEntryAction({ titulo: title, tipo: "tarefa", area_slug: inbox, prazo: fromLocalInput(due) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle("");
      setDue("");
    });
  }

  return (
    <form onSubmit={submit} className="glass flex flex-wrap items-center gap-2 rounded-xl p-2">
      <Plus className="ml-1 size-4 text-muted-foreground" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nova tarefa (vai para a inbox)"
        className="h-9 min-w-40 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        aria-label="Nova tarefa"
      />
      <Input
        type="datetime-local"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        className="h-9 w-auto"
        aria-label="Prazo"
      />
      <Button type="submit" size="sm" disabled={pending || !title.trim()}>
        {pending ? <Loader2 className="animate-spin" /> : "Adicionar"}
      </Button>
    </form>
  );
}

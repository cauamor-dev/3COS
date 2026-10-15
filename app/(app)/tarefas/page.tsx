import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { getCachedMember, PAGE_DATA_LIFE } from "@/lib/auth";

export const metadata: Metadata = { title: "Tarefas" };

async function loadTasks() {
  "use cache: private";
  cacheLife(PAGE_DATA_LIFE);
  const member = await getCachedMember();
  if (!member) return null;
  return { tasks: await member.central.tasksForPanel(), serverNow: Date.now() };
}

async function Tasks() {
  const data = await loadTasks();
  if (!data) redirect("/login");
  const { tasks, serverNow } = data;
  return <TaskBoard tasks={tasks} serverNow={serverNow} />;
}

export default function TasksPage() {
  return (
    <>
      <PageHeader eyebrow="tarefas" title="O que falta fazer" description="Tarefas de todas as áreas, criadas por você, pela Vega ou pelo Nox." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-white/5" />}>
        <Tasks />
      </Suspense>
    </>
  );
}

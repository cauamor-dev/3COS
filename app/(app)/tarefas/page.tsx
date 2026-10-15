import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Tarefas" };

async function Tasks() {
  const { central } = await requireMember();
  const tasks = await central.tasksForPanel();
  return <TaskBoard tasks={tasks} />;
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

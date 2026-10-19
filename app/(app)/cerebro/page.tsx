import type { Metadata } from "next";
import { Suspense } from "react";
import { BrainView } from "@/components/brain/brain-view";
import { toGraphEntry } from "@/components/brain/graph-data";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Cérebro" };

async function Brain() {
  const { central } = await requireMember();
  const { entries } = await central.graph();
  return <BrainView initialEntries={entries.map(toGraphEntry)} />;
}

export default function BrainPage() {
  return (
    <>
      <PageHeader
        eyebrow="cérebro"
        title="Tudo conectado"
        description="Explore suas áreas, registros e conexões."
        className="md:mb-5"
      />
      <Suspense fallback={<div className="h-[calc(100dvh-13rem)] min-h-[420px] animate-pulse rounded-2xl bg-white/5" />}>
        <Brain />
      </Suspense>
    </>
  );
}

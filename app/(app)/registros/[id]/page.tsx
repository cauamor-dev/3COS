import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { CentralError } from "@/lib/central/errors";
import { PageHeader } from "@/components/shell/page-header";
import { BackButton } from "@/components/central/back-button";
import { EntryDetail } from "@/components/central/entry-detail";
import { EntryCard } from "@/components/central/entry-card";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { central } = await requireMember();
  const entry = await central.getEntry(id).catch(error => { if (error instanceof CentralError && error.code === "not_found") notFound(); throw error; });
  return <><PageHeader eyebrow={entry.area.name} title={entry.title} actions={<BackButton fallback={`/areas/${entry.area.slug}`} />} /><div className="space-y-4"><EntryCard entry={entry} /><EntryDetail key={`${entry.id}:${entry.revision}`} entry={entry} /></div></>;
}
export default function EntryPage({ params }: { params: Promise<{ id: string }> }) { return <Suspense fallback={<p>Carregando registro…</p>}><Detail params={params} /></Suspense>; }

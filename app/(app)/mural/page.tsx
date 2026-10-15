import type { Metadata } from "next";
import { Suspense } from "react";
import { MuralFeed } from "@/components/mural/mural-feed";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "Mural" };

async function Mural() {
  const { central } = await requireMember();
  const posts = await central.feed({ tipo: "post", limite: 100 });
  return <MuralFeed initial={posts.items} />;
}

export default function MuralPage() {
  return (
    <>
      <PageHeader eyebrow="mural" title="O que o time encontrou" description="Notícias, achados e resultados das tarefas agendadas, publicados pela Vega e pelo Nox." />
      <Suspense fallback={<div className="mx-auto h-64 max-w-2xl animate-pulse rounded-2xl bg-white/5" />}>
        <Mural />
      </Suspense>
    </>
  );
}

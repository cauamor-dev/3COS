import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { VersionList } from "@/components/history/version-list";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth";
import { CentralError } from "@/lib/central/errors";

export const metadata: Metadata = { title: "Histórico" };

type Params = PageProps<"/historico/[alvo]/[id]">["params"];

async function HistoryContent({ params }: { params: Params }) {
  const { alvo, id } = await params;
  if (alvo !== "area" && alvo !== "registro") notFound();
  const { central } = await requireMember();

  const load = async () => {
    if (alvo === "area") {
      const area = await central.getArea(id);
      return {
        title: area.name,
        backHref: `/areas/${area.slug}`,
        current: { title: null, content: area.summary_md },
        versions: await central.versions("areas", area.id),
      };
    }
    const entry = await central.getEntry(id);
    return {
      title: entry.title,
      backHref: `/registros/${entry.id}`,
      current: { title: entry.title, content: entry.content_md },
      versions: await central.versions("entries", entry.id),
    };
  };

  const data = await load().catch((error) => {
    if (error instanceof CentralError && error.code === "not_found") notFound();
    throw error;
  });

  return (
    <>
      <PageHeader
        eyebrow={alvo === "area" ? "histórico do resumo" : "histórico do registro"}
        title={data.title}
        description="Cada escrita de IA ou sua guarda a versão anterior. Restaurar também é reversível."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={data.backHref}>
              <ArrowLeft /> Voltar
            </Link>
          </Button>
        }
      />
      <VersionList current={data.current} versions={data.versions} />
    </>
  );
}

export default function HistoryPage(props: PageProps<"/historico/[alvo]/[id]">) {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-white/5" />}>
      <HistoryContent params={props.params} />
    </Suspense>
  );
}

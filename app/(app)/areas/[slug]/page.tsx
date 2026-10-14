import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AreaControls } from "@/components/areas/area-controls";
import { SummaryEditor } from "@/components/areas/summary-editor";
import { Timeline } from "@/components/areas/timeline";
import { KIND_LABEL } from "@/components/central/labels";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/auth";
import { CentralError } from "@/lib/central/errors";

export const metadata: Metadata = { title: "Área" };

async function AreaContent({ params }: { params: PageProps<"/areas/[slug]">["params"] }) {
  const { slug } = await params;
  const { central } = await requireMember();

  const area = await central.getArea(slug).catch((error) => {
    if (error instanceof CentralError && error.code === "not_found") notFound();
    throw error;
  });
  const entries = await central.areaEntries(area.id);

  return (
    <>
      <PageHeader
        eyebrow={`${KIND_LABEL[area.kind]} · /${area.slug}`}
        title={area.name}
        actions={<AreaControls key={area.updated_at} area={area} />}
      />
      <div className="space-y-8">
        <SummaryEditor area={area} />
        <Timeline entries={entries} />
      </div>
    </>
  );
}

export default function AreaPage(props: PageProps<"/areas/[slug]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-16 w-72 animate-pulse rounded-lg bg-white/5" />
          <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
        </div>
      }
    >
      <AreaContent params={props.params} />
    </Suspense>
  );
}

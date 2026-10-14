import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewAreaDialog } from "@/components/areas/new-area-dialog";
import { KIND_LABEL, STATUS_LABEL } from "@/components/central/labels";
import { SourceDot } from "@/components/central/source-badge";
import { TimeAgo } from "@/components/central/time-ago";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/auth";
import { AREA_STATUSES } from "@/lib/central/schemas";

export const metadata: Metadata = { title: "Áreas" };

async function AreasList() {
  const { central } = await requireMember();
  const areas = await central.listAllAreas();

  return (
    <div className="space-y-8">
      {AREA_STATUSES.map((status) => {
        const group = areas.filter((area) => area.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status}>
            <h2 className="label-mono mb-3">
              {STATUS_LABEL[status]} · {group.length}
            </h2>
            <ul className="glass divide-y divide-white/5 overflow-hidden rounded-xl">
              {group.map((area) => (
                <li key={area.id}>
                  <Link href={`/areas/${area.slug}`} className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-white/[0.04]">
                    <SourceDot source={area.updated_by} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{area.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        /{area.slug} · {KIND_LABEL[area.kind]}
                      </p>
                    </div>
                    <TimeAgo date={area.updated_at} className="shrink-0 font-mono text-[11px] text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function AreasPage() {
  return (
    <>
      <PageHeader
        eyebrow="áreas"
        title="Tudo que a Central acompanha"
        description="Cada área tem um resumo vivo e uma linha do tempo de registros."
        actions={<NewAreaDialog />}
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-white/5" />}>
        <AreasList />
      </Suspense>
    </>
  );
}

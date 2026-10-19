import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { isDemo } from "@/lib/central/demo";
import { teamSnapshot } from "@/lib/team/snapshot";
import { TeamView } from "@/components/team/team-view";
import { PageHeader } from "@/components/shell/page-header";
async function Team({
  searchParams,
}: {
  searchParams: Promise<{ work?: string; tab?: string }>;
}) {
  const m = await requireMember();
  const focus = await searchParams;
  return (
    <TeamView
      key={`${focus.work ?? ""}:${focus.tab ?? ""}`}
      snapshot={await teamSnapshot(m.central.actor, isDemo(), focus.work)}
      focusWork={focus.work}
      focusTab={focus.tab}
    />
  );
}
export default function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ work?: string; tab?: string }>;
}) {
  return (
    <>
      <PageHeader
        eyebrow="seu espaço de trabalho"
        title="Equipe"
        description="Trabalhos e conversas, no mesmo lugar."
      />
      <Suspense fallback={<p>Carregando equipe…</p>}>
        <Team searchParams={searchParams} />
      </Suspense>
    </>
  );
}

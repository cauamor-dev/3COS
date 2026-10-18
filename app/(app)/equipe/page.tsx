import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { isDemo } from "@/lib/central/demo";
import { teamSnapshot } from "@/lib/team/snapshot";
import { TeamView } from "@/components/team/team-view";
import { PageHeader } from "@/components/shell/page-header";
async function Team(){const m=await requireMember();return <TeamView snapshot={await teamSnapshot(m.central.actor,isDemo())} />;}
export default function TeamPage(){return <><PageHeader eyebrow="coordenação" title="Equipe" description="Um dono e um próximo passo por trabalho. Entregas e decisões ficam ligadas às suas evidências." /><Suspense fallback={<p>Carregando equipe…</p>}><Team /></Suspense></>;}

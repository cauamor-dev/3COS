import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { isDemo } from "@/lib/central/demo";
import { FinanceView,type Transaction } from "@/components/finance/finance-view";
import { PageHeader } from "@/components/shell/page-header";
async function Finance(){const m=await requireMember();if(isDemo())return <FinanceView transactions={[]} demo />;const r=await m.supabase.from("personal_transactions").select("id,date,description,category,direction,amount,account_alias").eq("owner_id",m.central.actor.userId!).order("date",{ascending:false}).limit(2000);if(r.error)return <p>Finanças pessoais aguardando migração. Nenhuma conexão bancária foi criada.</p>;return <FinanceView transactions={(r.data??[]) as Transaction[]} />;}
export default function FinancePage(){return <><PageHeader eyebrow="pessoal e privado" title="Finanças pessoais" description="Lançamentos e CSV conferido. O financeiro da Axial continua no Painel separado." /><Suspense fallback={<p>Carregando finanças…</p>}><Finance /></Suspense></>;}

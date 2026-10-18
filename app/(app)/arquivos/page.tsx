import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { isDemo } from "@/lib/central/demo";
import { FileLibrary, type LibraryFile } from "@/components/central/file-library";
import { PageHeader } from "@/components/shell/page-header";
async function Files() {
 const m = await requireMember();
 if (isDemo()) return <FileLibrary files={[]} />;
 const { data,error } = await m.supabase.from("artifacts").select("id,name,mime,size_bytes,entry_id").eq("status","ready").order("created_at",{ascending:false}).limit(200);
 if(error) return <p>Biblioteca aguardando migração validada. Os anexos existentes continuam nos registros.</p>;
 return <FileLibrary files={(data ?? []) as LibraryFile[]} />;
}
export default function FilesPage() { return <><PageHeader eyebrow="biblioteca" title="Seus arquivos" description="Imagens, documentos e entregas. O acesso é conferido a cada abertura." /><Suspense fallback={<p>Carregando arquivos…</p>}><Files /></Suspense></>; }

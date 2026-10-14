import { Download, FileArchive } from "lucide-react";
import type { Metadata } from "next";
import { ImportForm } from "@/components/data/import-form";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Importar/Exportar" };

export default function DataPage() {
  return (
    <>
      <PageHeader
        eyebrow="dados"
        title="Seus dados, sempre portáveis"
        description="Exporte tudo a qualquer momento ou traga contexto de outros lugares."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="glass h-fit space-y-4 rounded-2xl p-5">
          <h2 className="font-medium">Exportar</h2>
          <p className="text-sm text-muted-foreground">Inclui áreas, resumos e todos os registros, até os arquivados.</p>
          <div className="flex flex-col gap-2">
            <Button variant="outline" asChild>
              <a href="/api/painel/export?formato=json" download>
                <Download /> JSON completo
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/painel/export?formato=md" download>
                <FileArchive /> Markdown (.zip)
              </a>
            </Button>
          </div>
        </section>
        <section className="glass space-y-4 rounded-2xl p-5">
          <h2 className="font-medium">Importar</h2>
          <ImportForm />
        </section>
      </div>
    </>
  );
}

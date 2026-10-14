"use client";

import { Eye, Loader2, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSummaryAction } from "@/app/(app)/actions";
import { SOURCE_LABEL } from "@/components/central/labels";
import { Markdown } from "@/components/central/markdown";
import { TimeAgo } from "@/components/central/time-ago";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Area } from "@/lib/central/types";

export function SummaryEditor({ area }: { area: Area }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(area.summary_md);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateSummaryAction({ area_slug: area.slug, resumo: draft });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Resumo salvo. A versão anterior está no histórico.");
      setEditing(false);
    });
  }

  return (
    <section className="glass rounded-2xl p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="label-mono mr-auto text-lilac">resumo vivo</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {SOURCE_LABEL[area.updated_by]} · <TimeAgo date={area.updated_at} />
        </span>
        {!editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(area.summary_md);
              setEditing(true);
            }}
          >
            <Pencil /> Editar
          </Button>
        )}
      </div>

      {editing ? (
        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit">
              <Pencil /> Markdown
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye /> Preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save();
              }}
              className="min-h-80 font-mono text-[13px] leading-relaxed"
              autoFocus
            />
          </TabsContent>
          <TabsContent value="preview" className="min-h-80 rounded-lg border p-4">
            <Markdown>{draft || "_Vazio_"}</Markdown>
          </TabsContent>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={pending || draft === area.summary_md}>
              {pending ? <Loader2 className="animate-spin" /> : "Salvar resumo"}
            </Button>
          </div>
        </Tabs>
      ) : area.summary_md.trim() ? (
        <Markdown>{area.summary_md}</Markdown>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sem resumo ainda. Escreva aqui ou peça para a IA atualizar o resumo desta área.
        </p>
      )}
    </section>
  );
}

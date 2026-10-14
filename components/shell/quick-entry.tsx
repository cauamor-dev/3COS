"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveEntryAction } from "@/app/(app)/actions";
import { TYPE_LABEL } from "@/components/central/labels";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ENTRY_TYPES, type EntryType } from "@/lib/central/schemas";

const NEW_AREA = "__nova__";

export function QuickEntry() {
  const { quickEntry, closeQuickEntry } = useCentral();

  return (
    <Dialog open={quickEntry.open} onOpenChange={(open) => !open && closeQuickEntry()}>
      <DialogContent className="glass max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo registro</DialogTitle>
          <DialogDescription>Fica visível na hora para Claude e ChatGPT.</DialogDescription>
        </DialogHeader>
        <QuickEntryForm initialArea={quickEntry.areaSlug ?? "inbox"} onSaved={closeQuickEntry} />
      </DialogContent>
    </Dialog>
  );
}

function QuickEntryForm({ initialArea, onSaved }: { initialArea: string; onSaved(): void }) {
  const { areas } = useCentral();
  const [areaSlug, setAreaSlug] = useState(initialArea);
  const [newAreaName, setNewAreaName] = useState("");
  const [type, setType] = useState<EntryType>("nota");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  const sortedAreas = [...areas]
    .filter((area) => area.status !== "arquivado")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!title.trim()) return;
    const creating = areaSlug === NEW_AREA;
    if (creating && !newAreaName.trim()) return;

    startTransition(async () => {
      const result = await saveEntryAction({
        area_slug: creating ? newAreaName : areaSlug,
        area_nome: creating ? newAreaName.trim() : undefined,
        tipo: type,
        titulo: title,
        conteudo: content,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Registro salvo");
      onSaved();
    });
  }

  return (
        <form
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={areaSlug} onValueChange={setAreaSlug}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedAreas.map((area) => (
                    <SelectItem key={area.id} value={area.slug}>
                      {area.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_AREA}>+ Nova área…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(value) => setType(value as EntryType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {TYPE_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {areaSlug === NEW_AREA && (
            <div className="space-y-2">
              <Label htmlFor="qe-area">Nome da nova área</Label>
              <Input id="qe-area" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="Ex.: Axial" required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="qe-title">Título</Label>
            <Input id="qe-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que aconteceu?" required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qe-content">Texto</Label>
            <Textarea
              id="qe-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Markdown é bem-vindo"
              className="min-h-32 font-mono text-[13px]"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="label-mono hidden sm:block">ctrl + enter</span>
            <Button type="submit" disabled={pending} className="ml-auto">
              {pending ? <Loader2 className="animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
  );
}

export function QuickEntryFab() {
  const { openQuickEntry } = useCentral();
  return (
    <Button
      onClick={() => openQuickEntry()}
      size="lg"
      className="fixed right-6 bottom-6 z-30 hidden h-12 rounded-full px-5 shadow-[0_10px_40px_-8px_oklch(0.62_0.24_293/0.7)] md:inline-flex"
    >
      <Plus /> Novo registro
    </Button>
  );
}

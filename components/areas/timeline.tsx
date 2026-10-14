"use client";

import { Archive, ArchiveRestore, History, Loader2, MoreHorizontal, Pencil, Pin, PinOff } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { editEntryAction } from "@/app/(app)/actions";
import { EntryCard } from "@/components/central/entry-card";
import { TYPE_LABEL } from "@/components/central/labels";
import { Markdown } from "@/components/central/markdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ENTRY_TYPES, type EditEntryInput, type EntryType } from "@/lib/central/schemas";
import type { Entry } from "@/lib/central/types";

export function Timeline({ entries }: { entries: Entry[] }) {
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [, startTransition] = useTransition();

  const visible = entries
    .filter((entry) => showArchived || !entry.archived)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  const archivedCount = entries.filter((entry) => entry.archived).length;

  function edit(input: EditEntryInput, message: string) {
    startTransition(async () => {
      const result = await editEntryAction(input);
      if (result.ok) toast.success(message);
      else toast.error(result.error);
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="mr-auto text-sm font-medium">
          Linha do tempo <span className="font-mono text-muted-foreground">· {entries.length - archivedCount}</span>
        </h2>
        {archivedCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} size="sm" />
            Arquivados ({archivedCount})
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="glass rounded-xl p-5 text-sm text-muted-foreground">Nenhum registro nesta área ainda.</p>
      ) : (
        <ol className="relative space-y-2.5 border-l border-white/10 pl-4 md:pl-5">
          {visible.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute top-5 -left-[21px] size-2 rounded-full bg-primary/70 ring-4 ring-background md:-left-[25px]" />
              <EntryCard entry={entry} showArea={false}>
                {expanded === entry.id && entry.content_md && (
                  <div className="mt-4 border-t pt-4">
                    <Markdown>{entry.content_md}</Markdown>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-1">
                  {entry.content_md.length > 0 && (
                    <Button variant="ghost" size="xs" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                      {expanded === entry.id ? "Recolher" : "Ler completo"}
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label="Ações do registro">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(entry)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => edit({ id: entry.id, fixado: !entry.pinned }, entry.pinned ? "Desafixado" : "Fixado")}
                      >
                        {entry.pinned ? <PinOff /> : <Pin />} {entry.pinned ? "Desafixar" : "Fixar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/historico/registro/${entry.id}`}>
                          <History /> Histórico
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() =>
                          edit({ id: entry.id, arquivado: !entry.archived }, entry.archived ? "Restaurado" : "Arquivado")
                        }
                      >
                        {entry.archived ? <ArchiveRestore /> : <Archive />} {entry.archived ? "Restaurar" : "Arquivar"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </EntryCard>
            </li>
          ))}
        </ol>
      )}

      {editing && <EditEntryDialog entry={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function EditEntryDialog({ entry, onClose }: { entry: Entry; onClose(): void }) {
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content_md);
  const [type, setType] = useState<EntryType>(entry.type);
  const [tags, setTags] = useState(entry.tags.join(", "));
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await editEntryAction({
        id: entry.id,
        titulo: title,
        conteudo: content,
        tipo: type,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Registro atualizado");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título</Label>
              <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
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
          <div className="space-y-2">
            <Label htmlFor="edit-content">Conteúdo</Label>
            <Textarea id="edit-content" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-60 font-mono text-[13px]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tags">Tags (separadas por vírgula)</Label>
            <Input id="edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

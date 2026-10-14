"use client";

import { History, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateAreaMetaAction } from "@/app/(app)/actions";
import { KIND_LABEL, STATUS_LABEL } from "@/components/central/labels";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AREA_KINDS, AREA_STATUSES, type AreaKind, type AreaStatus } from "@/lib/central/schemas";
import type { Area } from "@/lib/central/types";

export function AreaControls({ area }: { area: Area }) {
  const { openQuickEntry } = useCentral();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(area.name);

  function update(patch: { nome?: string; tipo?: AreaKind; status?: AreaStatus }) {
    startTransition(async () => {
      const result = await updateAreaMetaAction({ slug: area.slug, ...patch });
      if (result.ok) toast.success("Área atualizada");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={area.status} onValueChange={(status) => update({ status: status as AreaStatus })} disabled={pending}>
        <SelectTrigger size="sm" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AREA_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_LABEL[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={area.kind} onValueChange={(kind) => update({ tipo: kind as AreaKind })} disabled={pending}>
        <SelectTrigger size="sm" aria-label="Tipo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AREA_KINDS.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {KIND_LABEL[kind]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={() => setRenaming(true)}>
        <Pencil /> Renomear
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/historico/area/${area.slug}`}>
          <History /> Histórico
        </Link>
      </Button>
      <Button size="sm" onClick={() => openQuickEntry(area.slug)}>
        <Plus /> Registro
      </Button>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="glass sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear área</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              update({ nome: name });
              setRenaming(false);
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            <p className="text-xs text-muted-foreground">O slug /{area.slug} continua o mesmo para não quebrar as IAs.</p>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

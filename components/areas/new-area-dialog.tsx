"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAreaAction } from "@/app/(app)/actions";
import { KIND_LABEL } from "@/components/central/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AREA_KINDS, type AreaKind } from "@/lib/central/schemas";

export function NewAreaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AreaKind>("projeto");
  const [summary, setSummary] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createAreaAction({ nome: name, tipo: kind, resumo: summary });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      setName("");
      setSummary("");
      router.push(`/areas/${result.data.slug}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nova área
        </Button>
      </DialogTrigger>
      <DialogContent className="glass sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova área</DialogTitle>
          <DialogDescription>Um projeto, trabalho, disciplina ou curso com resumo vivo próprio.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="area-name">Nome</Label>
            <Input id="area-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Faculdade — Grafos" required />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as AreaKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AREA_KINDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {KIND_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="area-summary">Resumo inicial (opcional)</Label>
            <Textarea id="area-summary" value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-24 font-mono text-[13px]" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : "Criar área"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

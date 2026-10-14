"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { importAction } from "@/app/(app)/actions";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NEW_AREA = "__nova__";

export function ImportForm() {
  const { areas } = useCentral();
  const [areaSlug, setAreaSlug] = useState("inbox");
  const [newArea, setNewArea] = useState("");
  const [mode, setMode] = useState<"registro" | "resumo">("registro");
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const arquivos = await Promise.all(files.map(async (file) => ({ nome: file.name, conteudo: await file.text() })));
      if (pasted.trim()) arquivos.push({ nome: "texto-colado.md", conteudo: pasted });
      if (arquivos.length === 0) {
        toast.error("Escolha arquivos .md ou cole um texto.");
        return;
      }
      const creating = areaSlug === NEW_AREA;
      const result = await importAction({
        area_slug: creating ? newArea : areaSlug,
        area_nome: creating ? newArea : undefined,
        modo: mode,
        arquivos,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "resumo" ? "Resumo importado" : `${result.data.imported} registro(s) importado(s)`);
      setFiles([]);
      setPasted("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Área de destino</Label>
          <Select value={areaSlug} onValueChange={setAreaSlug}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.slug}>
                  {area.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_AREA}>+ Nova área…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Importar como</Label>
          <Select value={mode} onValueChange={(value) => setMode(value as "registro" | "resumo")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="registro">Um registro por arquivo</SelectItem>
              <SelectItem value="resumo">Substituir o resumo da área</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {areaSlug === NEW_AREA && (
        <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Nome da nova área" required />
      )}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors duration-150 hover:border-primary/50 hover:bg-primary/5">
        <FileUp className="size-5 text-lilac" />
        {files.length > 0 ? `${files.length} arquivo(s): ${files.map((f) => f.name).join(", ")}` : "Escolher arquivos .md ou .txt"}
        <input
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          multiple
          className="sr-only"
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
        />
      </label>
      <div className="space-y-2">
        <Label htmlFor="pasted">Ou cole um texto (ex.: o antigo doc do Drive)</Label>
        <Textarea id="pasted" value={pasted} onChange={(e) => setPasted(e.target.value)} className="min-h-32 font-mono text-[13px]" placeholder="# Título&#10;&#10;Conteúdo em markdown…" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : "Importar"}
      </Button>
    </form>
  );
}

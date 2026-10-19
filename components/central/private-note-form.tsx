"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { savePrivateNoteAction } from "@/app/(app)/seguro/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function PrivateNoteForm({ demo }: { demo: boolean }) {
  const [pending, run] = useTransition();
  const [message, setMessage] = useState("");
  const [savedId, setSavedId] = useState<string>();
  return (
    <form
      className="glass space-y-4 rounded-2xl p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget,
          data = new FormData(form);
        setMessage("");
        setSavedId(undefined);
        run(async () => {
          const result = await savePrivateNoteAction({
            title: data.get("title"),
            content: data.get("content"),
          });
          if (!result.ok) setMessage(result.error);
          else {
            form.reset();
            setSavedId(result.data.id);
            setMessage("Nota privada salva.");
          }
        });
      }}
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <LockKeyhole className="size-5 text-lilac" /> Nova nota privada
      </h2>
      <div className="space-y-2">
        <Label htmlFor="private-title">Título</Label>
        <Input
          id="private-title"
          name="title"
          required
          maxLength={200}
          placeholder="Ex.: Informações importantes"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="private-content">Informação</Label>
        <Textarea
          id="private-content"
          name="content"
          required
          maxLength={50000}
          className="min-h-40"
          placeholder="Guarde aqui o que precisa consultar depois."
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || demo}>
          {pending ? "Salvando…" : "Salvar nota privada"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Excluída do acesso das IAs da Central
        </span>
      </div>
      {demo && (
        <p className="text-xs text-muted-foreground">
          Demonstração visual. Entre na Central para salvar.
        </p>
      )}
      <p role="status" className="text-sm">
        {message}{" "}
        {savedId && (
          <Link className="text-lilac underline" href={`/registros/${savedId}`}>
            Abrir nota
          </Link>
        )}
      </p>
    </form>
  );
}

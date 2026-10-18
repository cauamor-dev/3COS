"use client";
import { useState } from "react";
import Link from "next/link";
import { AttachmentPicker, useAttachments } from "./attachments";
import { Input } from "@/components/ui/input";
export interface LibraryFile {
  id: string;
  name: string;
  mime: string;
  size_bytes: number;
  entry_id: string | null;
}
export function FileLibrary({ files }: { files: LibraryFile[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const uploads = useAttachments();
  return (
    <div className="space-y-4">
      <AttachmentPicker attachments={uploads} />
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-0 flex-1"
          aria-label="Buscar arquivo"
          placeholder="Buscar arquivo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Tipo de arquivo"
          className="rounded-lg border bg-background p-2"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">Todos</option>
          <option value="image/">Imagens</option>
          <option value="video/">Vídeos</option>
          <option value="application/">Documentos</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {files
          .filter(
            (f) =>
              f.name.toLowerCase().includes(query.toLowerCase()) &&
              (type === "all" || f.mime.startsWith(type)),
          )
          .map((f) => (
            <article key={f.id} className="glass min-w-0 rounded-xl p-4">
              <a
                className="block truncate text-lilac"
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {f.name}
              </a>
              <p className="my-2 text-xs text-muted-foreground">
                {f.mime} · {(f.size_bytes / 1048576).toFixed(2)} MB
              </p>
              {f.mime.startsWith("image/") && (
                <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- authorized artifact endpoint */}
                  <img
                    alt={f.name}
                    loading="lazy"
                    className="max-h-40 rounded-lg object-contain"
                    src={`/api/files/${f.id}`}
                  />
                </a>
              )}
              {f.entry_id && (
                <Link
                  className="text-xs text-lilac"
                  href={`/registros/${f.entry_id}`}
                >
                  Abrir registro
                </Link>
              )}
            </article>
          ))}
      </div>
      {!files.length && (
        <p className="text-sm text-muted-foreground">
          Nenhum arquivo na biblioteca nova. Os anexos anteriores continuam nos
          registros. Envie um arquivo ou anexe ao editar um registro.
        </p>
      )}
    </div>
  );
}

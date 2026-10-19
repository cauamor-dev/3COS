"use client";
import { useState } from "react";
import Link from "next/link";
import { AttachmentPicker, useAttachments } from "./attachments";
import { Input } from "@/components/ui/input";
import { FieldSelect } from "@/components/ui/field-select";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderOpen } from "lucide-react";
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
  const visible = files.filter(
    (f) =>
      f.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (type === "all" || f.mime.startsWith(type)),
  );
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
        <div className="w-full sm:w-44">
          <FieldSelect
            label="Tipo de arquivo"
            value={type}
            onValueChange={setType}
            options={[
              { value: "all", label: "Todos" },
              { value: "image/", label: "Imagens" },
              { value: "video/", label: "Vídeos" },
              { value: "application/", label: "Documentos" },
            ]}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((f) => (
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
      {!visible.length && (
        <EmptyState
          icon={FolderOpen}
          title={
            files.length ? "Nenhum arquivo encontrado" : "Seus arquivos, juntos"
          }
          description={
            files.length
              ? "Tente outro nome ou tipo de arquivo."
              : "Envie um arquivo ou anexe ao editar um registro. Os anexos anteriores continuam nos registros."
          }
        />
      )}
    </div>
  );
}

"use client";

import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ACCEPTED_FILES, FILES_BUCKET, MAX_FILE_BYTES, SIGNED_URL_SECONDS, storagePath, typeFromName } from "@/lib/files/shared";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export interface Attachment {
  url: string;
  name: string;
  image: boolean;
}

/** Phone photos are huge: resize to 1600px and re-encode as WebP before uploading. */
async function compress(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Uploads straight from the browser to the private bucket (the member's session passes the RLS policy). */
export async function uploadAttachment(file: File): Promise<Attachment> {
  const image = file.type.startsWith("image/");
  const body = image ? await compress(file) : file;
  if (body.size > MAX_FILE_BYTES) throw new Error(`${file.name}: maior que 10 MB.`);
  const contentType = body.type || file.type || typeFromName(file.name) || "application/octet-stream";
  const path = storagePath(contentType);
  const bucket = createBrowserSupabase().storage.from(FILES_BUCKET);
  const { error } = await bucket.upload(path, body, { contentType });
  if (error) throw new Error(error.message);
  const { data, error: signError } = await bucket.createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signError || !data) throw new Error(signError?.message ?? "Não foi possível gerar o link.");
  return { url: data.signedUrl, name: file.name || (image ? "Imagem" : "Arquivo"), image };
}

export function useAttachments() {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(0);

  async function add(files: Iterable<File>) {
    const list = [...files].slice(0, 8);
    if (!list.length) return;
    setBusy((n) => n + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          const attachment = await uploadAttachment(file);
          setItems((current) => [...current, attachment]);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Falha ao enviar o arquivo.");
        } finally {
          setBusy((n) => n - 1);
        }
      }),
    );
  }

  return {
    items,
    busy: busy > 0,
    add,
    remove: (url: string) => setItems((current) => current.filter((item) => item.url !== url)),
    clear: () => setItems([]),
    /** Handlers for the form: paste or drop images and files anywhere on it. */
    formProps: {
      onPaste: (event: React.ClipboardEvent) => {
        const files = [...event.clipboardData.files];
        if (files.length) {
          event.preventDefault();
          void add(files);
        }
      },
      onDragOver: (event: React.DragEvent) => event.preventDefault(),
      onDrop: (event: React.DragEvent) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        void add(event.dataTransfer.files);
      },
    },
  };
}

export type Attachments = ReturnType<typeof useAttachments>;

/** Fields for saveEntry: the first image highlights the entry, every file goes in its links. */
export function attachmentFields(items: Attachment[]) {
  const firstImage = items.find((item) => item.image);
  return {
    ...(firstImage && { imagem: firstImage.url }),
    links: items.map((item) => ({ url: item.url, titulo: item.name, ...(item.image && { imagem: item.url }) })),
  };
}

/** Hidden file input plus a click handler, shared by the labelled picker and the compact clip. */
function useFileInput(attachments: Attachments) {
  const input = useRef<HTMLInputElement>(null);
  const field = (
    <input
      ref={input}
      type="file"
      accept={ACCEPTED_FILES}
      multiple
      hidden
      onChange={(event) => {
        if (event.target.files) void attachments.add(event.target.files);
        event.target.value = "";
      }}
    />
  );
  return { field, open: () => input.current?.click() };
}

export function AttachmentList({ attachments }: { attachments: Attachments }) {
  if (!attachments.items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {attachments.items.map((item) => (
        <li key={item.url} className="relative">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed link from our own storage
            <img src={item.url} alt={item.name} className="size-16 rounded-lg border object-cover" />
          ) : (
            <span className="flex h-16 w-32 items-center gap-1.5 rounded-lg border px-2 text-xs text-muted-foreground">
              <FileText className="size-4 shrink-0" />
              <span className="truncate">{item.name}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => attachments.remove(item.url)}
            aria-label={`Remover ${item.name}`}
            className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Icon-only clip for tight spots like the Chloe command bar. */
export function AttachmentClip({ attachments, className }: { attachments: Attachments; className?: string }) {
  const { field, open } = useFileInput(attachments);
  return (
    <>
      <button type="button" onClick={open} aria-label="Anexar imagem ou arquivo" className={className}>
        {attachments.busy ? <Loader2 className="size-5 animate-spin" /> : <Paperclip className="size-5" />}
      </button>
      {field}
    </>
  );
}

export function AttachmentPicker({ attachments }: { attachments: Attachments }) {
  const { field, open } = useFileInput(attachments);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={open}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-sm text-muted-foreground transition-colors duration-150 hover:border-primary/50 hover:text-foreground"
        >
          {attachments.busy ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {attachments.busy ? "Enviando…" : "Anexar imagem ou arquivo"}
        </button>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">ou cole / arraste aqui</span>
        {field}
      </div>
      <AttachmentList attachments={attachments} />
    </div>
  );
}

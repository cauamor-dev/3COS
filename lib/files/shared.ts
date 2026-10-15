/** Private Supabase Storage bucket for images and files (see the storage_arquivos migration). */
export const FILES_BUCKET = "arquivos";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Links are long-lived capabilities: unguessable, and revoked by deleting the file. */
export const SIGNED_URL_SECONDS = 10 * 365 * 24 * 3600;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

/** yyyy/mm/<uuid>.<ext>: random names, so a link can't be guessed from another. */
export function storagePath(contentType: string, now = new Date()) {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${EXTENSIONS[contentType] ?? "bin"}`;
}

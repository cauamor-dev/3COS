/** Private Supabase Storage bucket for images and files (see the storage_arquivos migration). */
export const FILES_BUCKET = "arquivos";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Download capabilities expire in ten minutes; the stable endpoint rechecks authorization. */
export const SIGNED_URL_SECONDS = 10 * 60;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** Content type from the file name, for files the browser hands over without one (e.g. .md on Windows). */
export function typeFromName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return Object.entries(EXTENSIONS).find(([, value]) => value === ext)?.[0] ?? (ext === "jpeg" ? "image/jpeg" : undefined);
}

/** File types the bucket accepts. */
export function isAcceptedType(contentType: string | undefined) {
  return !!contentType && contentType in EXTENSIONS;
}

/** What the file pickers offer: images, PDF, text and Office documents. */
export const ACCEPTED_FILES = `image/*,.pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,${Object.keys(EXTENSIONS).join(",")}`;

/** yyyy/mm/<uuid>.<ext>: random names, so a link can't be guessed from another. */
export function storagePath(contentType: string, now = new Date()) {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${EXTENSIONS[contentType] ?? "bin"}`;
}

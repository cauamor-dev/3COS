import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILES_BUCKET, MAX_FILE_BYTES, SIGNED_URL_SECONDS, storagePath } from "./shared";

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|heic|heif)$/;

/** True for links that already point to our own private bucket. */
export function isStoredUrl(url: string) {
  return url.includes(`/storage/v1/object/sign/${FILES_BUCKET}/`);
}

/** Saves bytes in the private bucket and returns a long-lived signed link. */
export async function storeBytes(bytes: ArrayBuffer, contentType: string) {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("Arquivo maior que 10 MB.");
  const db = createAdminClient();
  const path = storagePath(contentType);
  const { error } = await db.storage.from(FILES_BUCKET).upload(path, bytes, { contentType });
  if (error) throw new Error(error.message);
  const { data, error: signError } = await db.storage.from(FILES_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signError || !data) throw new Error(signError?.message ?? "Não foi possível gerar o link do arquivo.");
  return data.signedUrl;
}

// The server fetches a URL chosen by an AI, so it must never reach private networks.
function isPublicHttpUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return !(
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".internal") ||
      /^(127|10|0)\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.startsWith("[")
    );
  } catch {
    return false;
  }
}

// Follows redirects by hand so every hop is checked, not only the first address.
async function fetchPublic(url: string, hops = 0): Promise<Response> {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; 3C-OS/1.0)" },
  });
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) {
    const next = new URL(location, url).toString();
    if (hops >= 3 || !isPublicHttpUrl(next)) throw new Error("Redirecionamento não permitido.");
    return fetchPublic(next, hops + 1);
  }
  return response;
}

/** Copies an image an AI linked to into our bucket, so it survives the original site removing it. */
export async function persistRemoteImage(url: string) {
  if (isStoredUrl(url) || !isPublicHttpUrl(url)) return url;
  const response = await fetchPublic(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!IMAGE_TYPES.test(type)) throw new Error("O link não é uma imagem.");
  if (Number(response.headers.get("content-length") ?? 0) > MAX_FILE_BYTES) throw new Error("Imagem maior que 10 MB.");
  return storeBytes(await response.arrayBuffer(), type);
}

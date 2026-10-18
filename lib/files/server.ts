import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILES_BUCKET, MAX_FILE_BYTES, storagePath } from "./shared";
import { serverEnv } from "@/lib/env";
import type { Entry } from "@/lib/central/types";
import { canEntry,type ActorContext } from "@/lib/central/access";

/** True for links that already point to our own private bucket. */
export function isStoredUrl(url: string) {
  return url.includes(`/storage/v1/object/sign/${FILES_BUCKET}/`);
}

/** Legacy byte capture; new browser/agent uploads use artifact reservations. */
export async function storeBytes(bytes: ArrayBuffer, contentType: string) {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("Arquivo maior que 10 MB.");
  const db = createAdminClient();
  const path = storagePath(contentType);
  const { error } = await db.storage.from(FILES_BUCKET).upload(path, bytes, { contentType });
  if (error) throw new Error(error.message);
  const owner=await db.from("entries").select("owner_id").not("owner_id","is",null).limit(1).maybeSingle();
  const artifact=await db.from("artifacts").insert({owner_id:owner.data?.owner_id??null,name:"Anexo recebido",mime:contentType,size_bytes:bytes.byteLength,object_path:path,status:"ready",visibility:"private"}).select("id").single();
  if(artifact.error||!artifact.data)throw new Error("Arquivo recebido; registro da biblioteca pendente.");
  return `${serverEnv.appUrl}/api/files/${artifact.data.id}`;
}

/** Only bind objects already owned by the authenticated user or a granted existing entry. */
export async function linkEntryFiles(entry:Entry,actor:ActorContext) {
 if(!canEntry(actor,entry))return;
 const urls=[entry.image_url,...(entry.links??[]).flatMap(l=>[l.url,l.imagem])].filter((s):s is string=>!!s);
 const db=createAdminClient();
 for(const raw of urls){let url:URL;try{url=new URL(raw);}catch{continue;}
  if(url.origin!==new URL(serverEnv.appUrl).origin)continue;const match=url.pathname.match(/^\/api\/files\/([0-9a-f-]{36})$/i);if(!match)continue;
  const result=await db.from("artifacts").select("id,owner_id,entry_id").eq("id",match[1]).maybeSingle();const f=result.data;
  if(!f||!actor.userId||f.owner_id!==actor.userId|| (f.entry_id&&f.entry_id!==entry.id))continue;
  await db.from("artifacts").update({entry_id:entry.id,area_id:entry.area_id,visibility:entry.ai_access==="private"?"private":entry.ai_access==="restricted"?"restricted":"shared"}).eq("id",f.id);
 }
 // Privacy changes also apply to artifacts already attached to this entry.
 await db.from("artifacts").update({visibility:entry.ai_access==="private"?"private":entry.ai_access==="restricted"?"restricted":"shared",area_id:entry.area_id}).eq("entry_id",entry.id);
}

/** Remote references stay remote. Server fetching of user URLs is intentionally disabled;
 * authenticated direct upload avoids DNS rebinding, private-IP redirects and metadata requests. */
export async function persistRemoteImage(url: string) {
  return url;
}

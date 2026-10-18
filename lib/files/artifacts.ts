import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { CentralError } from "@/lib/central/errors";
import { adminCentral } from "@/lib/central/server";
import { assertArea, type ActorContext } from "@/lib/central/access";
import {
  FILES_BUCKET,
  isAcceptedType,
  MAX_FILE_BYTES,
  MAX_VIDEO_BYTES,
  SIGNED_URL_SECONDS,
  storagePath,
} from "./shared";

export const artifactInput = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().max(150),
  size: z.number().int().positive(),
  entry_id: z.uuid().optional(),
});
export class ArtifactService {
  private readonly db = createAdminClient();
  constructor(private readonly actor: ActorContext) {}
  private async authorize(file: {
    owner_id: string | null;
    entry_id: string | null;
    area_id: string | null;
    visibility: string;
  }) {
    if (
      this.actor.kind === "human" &&
      this.actor.userId &&
      file.owner_id === this.actor.userId
    )
      return;
    if (!file.entry_id || !file.area_id || file.visibility === "private")
      throw new CentralError("forbidden", "Arquivo privado ou sem concessão.");
    assertArea(this.actor, file.area_id, "files");
    await adminCentral(this.actor).getEntry(file.entry_id);
  }
  async reserve(raw: z.input<typeof artifactInput>) {
    const input = artifactInput.parse(raw);
    const max = input.mime === "video/mp4" ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
    if (!isAcceptedType(input.mime) || input.size > max)
      throw new CentralError(
        "invalid",
        "Tipo ou tamanho inválido (documentos 10 MB; MP4 50 MB).",
      );
    let areaId: string | null = null;
    if (input.entry_id) {
      const entry = await adminCentral(this.actor).getEntry(input.entry_id);
      assertArea(this.actor, entry.area_id, "files");
      areaId = entry.area_id;
    } else if (this.actor.kind !== "human")
      throw new CentralError(
        "forbidden",
        "A integração deve vincular o arquivo a um registro autorizado.",
      );
    const path = storagePath(input.mime);
    const reserved = await this.db.rpc("reserve_artifact", {
      p_owner: this.actor.userId ?? null,
      p_entry: input.entry_id ?? null,
      p_area: areaId,
      p_name: input.name,
      p_mime: input.mime,
      p_size: input.size,
      p_path: path,
    });
    if (reserved.error)
      throw new CentralError(
        "quota",
        "Armazenamento sem reserva disponível; mantenha o arquivo no executor ou Drive autorizado.",
      );
    const id = reserved.data as string;
    const { data, error } = await this.db.storage
      .from(FILES_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) throw new Error("Não foi possível autorizar o upload.");
    return { id, path, upload_url: data.signedUrl, token: data.token };
  }
  async finalize(id: string) {
    const file = await this.get(id);
    await this.authorize(file);
    if (file.status === "ready") return { id, url: `/api/files/${id}` };
    if (Date.parse(file.reservation_expires_at) <= Date.now())
      throw new CentralError("invalid", "Reserva expirada; refaça o upload.");
    const { data, error } = await this.db.storage
      .from(FILES_BUCKET)
      .info(file.object_path);
    if (error || !data)
      throw new CentralError(
        "invalid",
        "Arquivo ainda não recebido pelo Storage.",
      );
    const actualSize = Number(data.size ?? data.metadata?.size ?? 0);
    const actualType = data.contentType ?? data.metadata?.mimetype;
    if (actualSize !== file.size_bytes || actualType !== file.mime) {
      await this.db
        .from("artifacts")
        .update({ status: "rejected" })
        .eq("id", id);
      throw new CentralError(
        "invalid",
        "O arquivo recebido diverge do tipo ou tamanho autorizado.",
      );
    }
    const object = await this.db.storage
      .from(FILES_BUCKET)
      .download(file.object_path);
    if (object.error || !object.data)
      throw new CentralError(
        "invalid",
        "Não foi possível verificar o conteúdo recebido.",
      );
    const sha256 = createHash("sha256")
      .update(Buffer.from(await object.data.arrayBuffer()))
      .digest("hex");
    const entry = file.entry_id
      ? await adminCentral(this.actor).getEntry(file.entry_id)
      : null;
    const result = await this.db
      .from("artifacts")
      .update({
        status: "ready",
        sha256,
        visibility: entry?.ai_access ?? "private",
      })
      .eq("id", id)
      .eq("status", "reserved");
    if (result.error) throw new Error("Falha ao finalizar arquivo.");
    return { id, url: `/api/files/${id}` };
  }
  async download(id: string) {
    const file = await this.get(id);
    await this.authorize(file);
    if (file.status !== "ready")
      throw new CentralError("invalid", "Arquivo ainda não finalizado.");
    const result = await this.db.storage
      .from(FILES_BUCKET)
      .createSignedUrl(file.object_path, SIGNED_URL_SECONDS);
    if (result.error || !result.data)
      throw new Error("Falha ao abrir arquivo.");
    return result.data.signedUrl;
  }
  async get(id: string) {
    z.uuid().parse(id);
    const { data, error } = await this.db
      .from("artifacts")
      .select(
        "id,owner_id,entry_id,area_id,name,mime,size_bytes,object_path,visibility,status,reservation_expires_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data)
      throw new CentralError("not_found", "Arquivo não encontrado.");
    return data;
  }
}

"use server";
import { refresh } from "next/cache";
import { getMember } from "@/lib/auth";
import { savePrivateNote } from "@/lib/central/private-notes";
import { describeError } from "@/lib/central/format-error";
import type { ActionResult } from "../actions";

export async function savePrivateNoteAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const member = await getMember();
  if (!member?.central.actor.userId)
    return {
      ok: false,
      error: "Entre com sua conta para salvar uma nota privada.",
    };
  try {
    const result = await savePrivateNote(member.central, raw);
    refresh();
    return { ok: true, data: { id: result.registro.id } };
  } catch (error) {
    return { ok: false, error: describeError(error).message };
  }
}

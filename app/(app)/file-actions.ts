"use server";
import { getMember } from "@/lib/auth";
import {isDemo} from "@/lib/central/demo";
import { ArtifactService, artifactInput } from "@/lib/files/artifacts";
import { describeError } from "@/lib/central/format-error";
import type { z } from "zod";
import type { ActionResult } from "./actions";
export async function reserveFileAction(input: z.input<typeof artifactInput>) {
  if(isDemo())return {ok:false as const,error:"Demonstração: upload real exige login na Central."};
  const m = await getMember(); if (!m) return { ok: false as const, error: "Sessão expirada." };
  try { return { ok: true as const, data: await new ArtifactService(m.central.actor).reserve(input) }; }
  catch (e) { return { ok: false as const, error: describeError(e).message }; }
}
export async function finalizeFileAction(id: string): Promise<ActionResult<{ id: string; url: string }>> {
  if(isDemo())return {ok:false,error:"Demonstração: upload real exige login na Central."};
  const m = await getMember(); if (!m) return { ok: false, error: "Sessão expirada." };
  try { return { ok: true, data: await new ArtifactService(m.central.actor).finalize(id) }; }
  catch (e) { return { ok: false, error: describeError(e).message }; }
}

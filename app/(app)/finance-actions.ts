"use server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { refresh } from "next/cache";
import { getMember } from "@/lib/auth";
import {
  parseFinanceCsv,
  transactionInput,
  possibleFinanceMatches,
} from "@/lib/finance/csv";
import { checked } from "@/lib/team/service";
import { describeError } from "@/lib/central/format-error";
export async function addTransactionAction(raw: unknown) {
  const m = await getMember();
  if (!m?.central.actor.userId)
    return {
      ok: false as const,
      error: "Proprietário autenticado necessário.",
    };
  try {
    const i = transactionInput.parse(raw);
    checked(
      await m.supabase
        .from("personal_transactions")
        .insert({ ...i, owner_id: m.central.actor.userId }),
    );
    refresh();
    return { ok: true as const, data: undefined };
  } catch (e) {
    return { ok: false as const, error: describeError(e).message };
  }
}
export async function previewFinanceAction(csv: string) {
  const m = await getMember();
  if (!m?.central.actor.userId)
    return {
      ok: false as const,
      error: "Proprietário autenticado necessário.",
    };
  try {
    const parsed = parseFinanceCsv(csv);
    const hash = createHash("sha256").update(csv).digest("hex");
    const existing = await m.supabase
      .from("personal_finance_imports")
      .select("id")
      .eq("owner_id", m.central.actor.userId)
      .eq("file_hash", hash)
      .maybeSingle();
    const dates = parsed.rows.map((r) => r.date).sort();
    let matches: number[] = [];
    if (dates.length) {
      const saved = checked(
        await m.supabase
          .from("personal_transactions")
          .select("date,description,direction,amount")
          .eq("owner_id", m.central.actor.userId)
          .gte("date", dates[0])
          .lte("date", dates.at(-1)!)
          .limit(5000),
      );
      matches = possibleFinanceMatches(parsed.rows, saved);
    }
    return {
      ok: true as const,
      data: {
        ...parsed,
        hash,
        duplicate: !!existing.data,
        possible_matches: matches,
      },
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "CSV inválido.",
    };
  }
}
export async function commitFinanceAction(raw: unknown) {
  const m = await getMember();
  if (!m?.central.actor.userId)
    return {
      ok: false as const,
      error: "Proprietário autenticado necessário.",
    };
  try {
    const i = z
      .object({
        csv: z.string().max(2000000),
        account_alias: z.string().trim().min(1).max(80),
        categories: z.array(z.string().trim().min(1).max(80)).max(5000),
        reviewed: z.literal(true),
      })
      .parse(raw);
    const parsed = parseFinanceCsv(i.csv);
    if (parsed.errors.length)
      throw new Error("Corrija as linhas inválidas antes de importar.");
    if (i.categories.length !== parsed.rows.length)
      throw new Error("A prévia mudou; revise novamente.");
    const data = checked(
      await m.supabase.rpc("commit_finance_import", {
        p_owner: m.central.actor.userId,
        p_hash: createHash("sha256").update(i.csv).digest("hex"),
        p_alias: i.account_alias,
        p_rows: parsed.rows.map((r, index) => ({
          ...r,
          category: i.categories[index],
        })),
      }),
    );
    refresh();
    return { ok: true as const, data };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Falha na importação.",
    };
  }
}

import { z } from "zod";
export function moneyToCents(raw: string): number {
  let v = raw.trim().replace(/^R\$\s*/, "");
  if (v.includes(",")) {
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(v))
      throw new Error("Valor inválido");
    v = v.replaceAll(".", "").replace(",", ".");
  }
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(v))
    throw new Error("Use valor positivo com até duas casas decimais.");
  const [integer, fraction = ""] = v.split(".");
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 99999999999999)
    throw new Error("Valor fora do limite.");
  return cents;
}
export const centsToDecimal = (cents: number) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
export const transactionInput = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (d) =>
        !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().startsWith(d),
      "Data inválida",
    ),
  description: z.string().trim().min(1).max(300),
  category: z.string().trim().min(1).max(80),
  direction: z.enum(["entrada", "saida"]),
  amount: z.string().transform((v) => centsToDecimal(moneyToCents(v))),
  account_alias: z.string().trim().min(1).max(80),
});
export interface FinanceRow {
  date: string;
  description: string;
  category: string;
  direction: "entrada" | "saida";
  amount: string;
}
/** Cross-file matches are warnings only: identical legitimate expenses remain separate. */
export function possibleFinanceMatches(
  rows: FinanceRow[],
  existing: {
    date: string;
    description: string;
    direction: string;
    amount: string | number;
  }[],
) {
  const key = (r: {
    date: string;
    description: string;
    direction: string;
    amount: string | number;
  }) =>
    `${r.date}|${r.description.trim().toLocaleLowerCase("pt-BR")}|${r.direction}|${moneyToCents(String(r.amount))}`;
  const keys = new Set(existing.map(key));
  return rows.flatMap((r, index) => (keys.has(key(r)) ? [index] : []));
}
/** CSV with quoted delimiters/newlines, BOM and escaped quotes. Raw text never enters the database. */
export function parseFinanceCsv(text: string): {
  rows: FinanceRow[];
  errors: string[];
} {
  if (text.length > 2_000_000) throw new Error("CSV acima de 2 MB.");
  const raw = text.replace(/^\uFEFF/, "");
  const first = raw.split(/\r?\n/)[0];
  const separator = first.includes(";") ? ";" : ",";
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (quoted && raw[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === separator && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim())) records.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("Aspas não fechadas no CSV.");
  row.push(field);
  if (row.some((x) => x.trim())) records.push(row);
  if (records.length < 2 || records.length > 5001)
    throw new Error("CSV precisa ter cabeçalho e de 1 a 5.000 linhas.");
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const headers = records.shift()!.map(normalize);
  const aliases: Record<string, string[]> = {
    date: ["data", "date"],
    description: ["descricao", "description"],
    category: ["categoria", "category"],
    direction: ["direcao", "direction", "tipo"],
    amount: ["valor", "amount"],
  };
  const columns = Object.fromEntries(
    Object.entries(aliases).map(([k, v]) => [
      k,
      headers.findIndex((h) => v.includes(h)),
    ]),
  );
  for (const key of ["date", "description", "direction", "amount"])
    if (columns[key] === -1)
      throw new Error(`Coluna obrigatória ausente: ${aliases[key][0]}.`);
  const rows: FinanceRow[] = [];
  const errors: string[] = [];
  records.forEach((cells, index) => {
    try {
      let date = cells[columns.date]?.trim() ?? "";
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(date))
        date = date.split("/").reverse().join("-");
      const direction = normalize(cells[columns.direction] ?? "");
      const parsed = transactionInput.parse({
        date,
        description: cells[columns.description],
        category: cells[columns.category]?.trim() || "A revisar",
        direction,
        amount: cells[columns.amount] ?? "",
        account_alias: "prévia",
      });
      const { account_alias: _account, ...item } = parsed;
      rows.push(item);
    } catch {
      errors.push(
        `Linha ${index + 2}: confira data, descrição, direção (entrada/saida) e valor positivo.`,
      );
    }
  });
  return { rows, errors };
}

"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addTransactionAction,
  previewFinanceAction,
  commitFinanceAction,
} from "@/app/(app)/finance-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { moneyToCents, type FinanceRow } from "@/lib/finance/csv";
import { Plus, Upload, Wallet } from "lucide-react";
import { FieldSelect } from "@/components/ui/field-select";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  direction: string;
  amount: string | number;
  account_alias: string;
}
const brl = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function FinanceView({
  transactions,
  demo = false,
}: {
  transactions: Transaction[];
  demo?: boolean;
}) {
  const [month, setMonth] = useState(
    new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    }),
  );
  const [pending, run] = useTransition();
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<{
    rows: FinanceRow[];
    errors: string[];
    duplicate: boolean;
    possible_matches: number[];
  } | null>(null);
  const [alias, setAlias] = useState("Pessoal");
  const [reviewed, setReviewed] = useState(false);
  const current = transactions.filter((t) => t.date.startsWith(month));
  const income = current
    .filter((t) => t.direction === "entrada")
    .reduce((sum, t) => sum + moneyToCents(String(t.amount)), 0);
  const expense = current
    .filter((t) => t.direction === "saida")
    .reduce((sum, t) => sum + moneyToCents(String(t.amount)), 0);
  return (
    <div className="space-y-5">
      {demo && (
        <p className="text-sm text-muted-foreground">
          Demonstração. Lançamentos reais exigem login do proprietário.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm">
          Mês
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 w-auto"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-10"
            onClick={() => setDialog("import")}
          >
            <Upload /> Importar CSV
          </Button>
          <Button className="h-10" onClick={() => setDialog("add")}>
            <Plus /> Lançamento
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Entradas", income],
          ["Saídas", expense],
          ["Saldo", income - expense],
        ].map(([label, value]) => (
          <div className="glass min-w-0 rounded-xl p-3" key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-all font-mono text-sm">
              {brl(Number(value))}
            </p>
          </div>
        ))}
      </div>
      <Dialog
        open={dialog === "add"}
        onOpenChange={(v) => !v && setDialog(null)}
      >
        <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
            <DialogDescription>
              Registre uma entrada ou saída.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 [&_input]:h-10 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                const r = await addTransactionAction(Object.fromEntries(f));
                if (!r.ok) toast.error(r.error);
                else {
                  toast.success("Lançamento salvo.");
                  setDialog(null);
                }
              });
            }}
          >
            <label className="space-y-2 text-sm">
              Data
              <Input
                name="date"
                type="date"
                required
                aria-label="Data do lançamento"
              />
            </label>
            <label className="space-y-2 text-sm">
              Descrição
              <Input
                name="description"
                required
                placeholder="Descrição"
                aria-label="Descrição"
              />
            </label>
            <label className="space-y-2 text-sm">
              Valor
              <Input
                name="amount"
                required
                inputMode="decimal"
                placeholder="Valor, ex.: 35,90"
                aria-label="Valor"
              />
            </label>
            <label className="space-y-2 text-sm">
              Movimento
              <FieldSelect
                name="direction"
                label="Direção"
                defaultValue="saida"
                options={[
                  { value: "saida", label: "Saída" },
                  { value: "entrada", label: "Entrada" },
                ]}
              />
            </label>
            <label className="space-y-2 text-sm">
              Categoria
              <Input
                name="category"
                required
                defaultValue="A revisar"
                aria-label="Categoria"
              />
            </label>
            <label className="space-y-2 text-sm">
              Conta
              <Input
                name="account_alias"
                required
                defaultValue="Pessoal"
                aria-label="Apelido da conta"
              />
            </label>
            <Button disabled={pending || demo}>Salvar lançamento</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === "import"}
        onOpenChange={(v) => !v && setDialog(null)}
      >
        <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar CSV</DialogTitle>
            <DialogDescription>
              Confira as linhas antes de salvar na Central.
            </DialogDescription>
          </DialogHeader>
          <section className="glass space-y-3 rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              Colunas: data;descricao;categoria;direcao;valor. Sem dados de
              cartão ou senha. Arquivo bruto não é armazenado. Correspondências
              entre arquivos são revisáveis, nunca removidas automaticamente.
            </p>
            <Input
              type="file"
              accept=".csv,text/csv"
              aria-label="Arquivo CSV financeiro"
              disabled={pending || demo}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2000000) {
                  toast.error("Limite de 2 MB.");
                  return;
                }
                const text = await file.text();
                setCsv(text);
                setPreview(null);
                setReviewed(false);
                run(async () => {
                  const r = await previewFinanceAction(text);
                  if (r.ok) setPreview(r.data);
                  else toast.error(r.error);
                });
              }}
            />
            {preview && (
              <>
                <p className="text-sm">
                  {preview.rows.length} linhas válidas.{" "}
                  {preview.duplicate
                    ? "Este arquivo já foi importado; reenviar não duplica lançamentos."
                    : "Confira os valores e ajuste as categorias antes de confirmar."}
                </p>
                {preview.possible_matches.length > 0 && (
                  <p role="status" className="text-sm text-amber-300">
                    {preview.possible_matches.length} linhas se parecem com
                    lançamentos já existentes. Confira a origem antes de
                    importar. Nenhuma linha será descartada automaticamente.
                  </p>
                )}
                {preview.errors.map((e) => (
                  <p className="text-xs text-destructive" key={e}>
                    {e}
                  </p>
                ))}
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Categoria</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="p-1 whitespace-nowrap">{r.date}</td>
                          <td className="max-w-40 p-1">
                            {r.description}
                            {preview.possible_matches.includes(i) && (
                              <span className="block text-amber-300">
                                Possível correspondência
                              </span>
                            )}
                          </td>
                          <td>
                            <Input
                              className="h-7 min-w-24 text-xs"
                              aria-label={`Categoria linha ${i + 1}`}
                              value={r.category}
                              onChange={(e) =>
                                setPreview((p) =>
                                  p
                                    ? {
                                        ...p,
                                        rows: p.rows.map((v, j) =>
                                          j === i
                                            ? { ...v, category: e.target.value }
                                            : v,
                                        ),
                                      }
                                    : p,
                                )
                              }
                            />
                          </td>
                          <td className="p-1 whitespace-nowrap">
                            {r.direction === "saida" ? "−" : "+"}
                            {brl(moneyToCents(r.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Input
                  aria-label="Apelido da origem CSV"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
                <label className="flex min-h-10 items-center gap-3 text-sm">
                  <Checkbox
                    checked={reviewed}
                    onCheckedChange={(v) => setReviewed(v === true)}
                  />{" "}
                  Revisei as linhas e a origem
                </label>
                <Button
                  disabled={
                    pending || !reviewed || !!preview.errors.length || demo
                  }
                  onClick={() =>
                    run(async () => {
                      const r = await commitFinanceAction({
                        csv,
                        account_alias: alias,
                        categories: preview.rows.map((r) => r.category),
                        reviewed: true,
                      });
                      if (r.ok) {
                        toast.success(
                          "Importação conferida; arquivo repetido não duplica dados.",
                        );
                        setPreview(null);
                        setCsv("");
                        setDialog(null);
                      } else toast.error(r.error);
                    })
                  }
                >
                  Confirmar importação
                </Button>
              </>
            )}
          </section>
        </DialogContent>
      </Dialog>
      <section className="space-y-2">
        <h2 className="font-medium">Lançamentos do mês</h2>
        {current.map((t) => (
          <article
            key={t.id}
            className="glass flex flex-wrap justify-between gap-2 rounded-xl p-3 text-sm"
          >
            <div>
              <p>{t.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.date} · {t.category} · {t.account_alias}
              </p>
            </div>
            <span>
              {t.direction === "saida" ? "−" : "+"}
              {brl(moneyToCents(String(t.amount)))}
            </span>
          </article>
        ))}
        {!current.length && (
          <EmptyState
            icon={Wallet}
            title="Seu mês começa aqui"
            description="Adicione um lançamento ou importe um CSV revisado."
          />
        )}
      </section>
    </div>
  );
}

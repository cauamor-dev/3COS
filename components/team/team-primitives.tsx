import { cn } from "cn";
import { STATUS_LABEL } from "@/lib/work/contracts";

export const PROVIDER_LABEL: Record<string, string> = {
  grok: "Grok Bot",
  claude: "Claude",
  chatgpt: "ChatGPT",
  codex: "Codex",
  cursor: "Cursor",
  opencode: "OpenCode",
  axial: "Painel Axial",
  groq: "IA da Chloe",
  telegram: "Telegram",
  gmail: "Gmail",
  calendar: "Google Agenda",
  drive: "Google Drive",
  x: "Pesquisa no X",
  social: "Redes sociais",
  human: "Você",
  central: "Central",
};
export const stepLabel = (step: string) => step === "done" ? "Entrega concluída" : STATUS_LABEL[step] ?? step;
export function TeamAvatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 font-mono font-medium text-lilac",
        small ? "size-7 text-[11px]" : "size-10 text-sm",
      )}
    >
      {name.slice(0, 2).toLocaleUpperCase("pt-BR")}
    </span>
  );
}
export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const warn = [
    "failed",
    "blocked",
    "uncertain",
    "waiting_approval",
    "pending",
    "expired",
  ].includes(status);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
        warn
          ? "border-amber-400/20 bg-amber-400/5 text-amber-200"
          : status === "running" || status === "verified"
            ? "border-primary/20 bg-primary/10 text-lilac"
            : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}

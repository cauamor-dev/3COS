"use client";

import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function mask(value: string, secret: string) {
  return value.replace(secret, "•".repeat(Math.min(secret.length, 24)));
}

export function CopyField({ label, value, secret }: { label: string; value: string; secret?: string }) {
  const [revealed, setRevealed] = useState(!secret);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copiado`);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-1.5">
      <p className="label-mono">{label}</p>
      <div className="flex items-center gap-1 rounded-lg border bg-black/30 p-1 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px]">
          {secret && !revealed ? mask(value, secret) : value}
        </code>
        {secret && (
          <Button variant="ghost" size="icon-sm" onClick={() => setRevealed(!revealed)} aria-label={revealed ? "Ocultar" : "Revelar"}>
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" onClick={copy} aria-label={`Copiar ${label}`}>
          {copied ? <Check className="text-emerald-400" /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

export function CopyBlock({ label, text }: { label: string; text: string }) {
  async function copy() {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="label-mono">{label}</p>
        <Button variant="outline" size="xs" onClick={copy}>
          <Copy /> Copiar
        </Button>
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg border bg-black/30 p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {text}
      </pre>
    </div>
  );
}

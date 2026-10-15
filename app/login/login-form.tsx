"use client";

import { ArrowRight, Loader2, Mail } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendLoginEmail, signOut, verifyLoginCode, type LoginState } from "./actions";

export function LoginForm({ next, linkError, blockedEmail }: { next: string; linkError: boolean; blockedEmail: string | null }) {
  const [emailState, sendAction, sending] = useActionState(sendLoginEmail, { step: "email", email: "" } as LoginState);
  const [codeState, verifyAction, verifying] = useActionState(
    (state: LoginState, formData: FormData) => verifyLoginCode({ ...state, email: emailState.email }, formData),
    { step: "code", email: "" } as LoginState,
  );

  if (blockedEmail) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Você entrou como <span className="font-mono text-foreground">{blockedEmail}</span>, mas este e-mail não tem acesso.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Sair e usar outro e-mail
          </Button>
        </form>
      </div>
    );
  }

  if (emailState.step === "code") {
    return (
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm">
          <Mail className="mt-0.5 size-4 shrink-0 text-lilac" />
          <p>
            Enviamos um link de acesso para <span className="font-medium">{emailState.email}</span>. Abra o link neste
            mesmo navegador. Se o e-mail trouxer um código, você também pode digitá-lo aqui.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={10}
            className="h-11 text-center font-mono text-lg tracking-[0.5em]"
            autoFocus
            required
          />
        </div>
        {codeState.error && <p className="text-sm text-destructive">{codeState.error}</p>}
        <Button type="submit" size="lg" className="h-11 w-full" disabled={verifying}>
          {verifying ? <Loader2 className="animate-spin" /> : "Entrar"}
        </Button>
      </form>
    );
  }

  return (
    <form action={sendAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          defaultValue={emailState.email}
          className="h-11"
          autoFocus
          required
        />
      </div>
      {(emailState.error || linkError) && (
        <p className="text-sm text-destructive">
          {emailState.error ?? "O link expirou ou já foi usado. Peça um novo."}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={sending}>
        {sending ? <Loader2 className="animate-spin" /> : <>Receber link de acesso <ArrowRight /></>}
      </Button>
    </form>
  );
}

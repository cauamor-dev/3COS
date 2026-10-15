"use client";

import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { subscribePushAction, testNotificationAction, unsubscribePushAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true);
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function detect(): Promise<State> {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return isIos() && !isStandalone() ? "install" : "unsupported";
      }
      if (Notification.permission === "denied") return "denied";
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? "on" : "off";
    }
    detect().then((next) => !cancelled && setState(next));
    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const result = await subscribePushAction({ ...json, userAgent: navigator.userAgent });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setState("on");
      toast.success("Notificações ativadas neste aparelho");
    });
  }

  function disable() {
    startTransition(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    });
  }

  function test() {
    startTransition(async () => {
      const result = await testNotificationAction();
      if (result.ok) toast.success("Teste enviado", { description: result.data });
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {state === "install" && (
        <p className="text-sm text-muted-foreground">
          No iPhone, as notificações só funcionam com a Central instalada: Safari → Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone e volte aqui.
        </p>
      )}
      {state === "unsupported" && <p className="text-sm text-muted-foreground">Este navegador não suporta notificações push.</p>}
      {state === "denied" && (
        <p className="text-sm text-muted-foreground">
          Notificações bloqueadas. Libere nos ajustes do aparelho (iPhone: Ajustes → Notificações → Central 3C) e recarregue.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {state === "off" && (
          <Button onClick={enable} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Bell />} Ativar neste aparelho
          </Button>
        )}
        {state === "on" && (
          <Button variant="outline" onClick={disable} disabled={pending}>
            <BellOff /> Desativar neste aparelho
          </Button>
        )}
        <Button variant="outline" onClick={test} disabled={pending || state === "loading"}>
          <Send /> Enviar teste
        </Button>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { notificationCountAction } from "@/app/(app)/notification-actions";
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    let last = 0;
    const load = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 15000)
        return;
      last = Date.now();
      void notificationCountAction().then((n) => {
        if (active) setUnread(n);
      });
    };
    load();
    const timer = setInterval(load, 120000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);
  return (
    <Link
      href="/notificacoes"
      aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}
      className="relative inline-flex size-9 items-center justify-center rounded-lg hover:bg-white/5"
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

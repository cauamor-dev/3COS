"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (
      process.env.NODE_ENV !== "production" &&
      !process.env.NEXT_PUBLIC_SW_IN_DEV
    ) {
      // A previous production preview may still control localhost and cache dev CSS.
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter((r) => r.active?.scriptURL === `${location.origin}/sw.js`)
              .map((r) => r.unregister()),
          ),
        )
        .catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

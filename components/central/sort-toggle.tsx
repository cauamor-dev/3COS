"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

export type SortOrder = "desc" | "asc";

const listeners = new Set<() => void>();
const memory = new Map<string, SortOrder>();
const storageKey = (screen: string) => `c3c-sort:${screen}`;

function read(screen: string): SortOrder {
  const cached = memory.get(screen);
  if (cached) return cached;
  try {
    return localStorage.getItem(storageKey(screen)) === "asc" ? "asc" : "desc";
  } catch {
    return "desc";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Newest first by default; the choice is remembered per screen. */
export function useSortOrder(screen: string) {
  const order = useSyncExternalStore(
    subscribe,
    () => read(screen),
    () => "desc" as SortOrder,
  );
  const toggle = useCallback(() => {
    const next: SortOrder = read(screen) === "desc" ? "asc" : "desc";
    memory.set(screen, next);
    try {
      localStorage.setItem(storageKey(screen), next);
    } catch {}
    for (const notify of listeners) notify();
  }, [screen]);
  return { order, toggle };
}

/** Compare ISO dates in the chosen order. */
export function byDate(order: SortOrder, a: string, b: string) {
  return order === "desc" ? b.localeCompare(a) : a.localeCompare(b);
}

export function SortToggle({ order, onToggle }: { order: SortOrder; onToggle(): void }) {
  const Icon = order === "desc" ? ArrowDownWideNarrow : ArrowUpNarrowWide;
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onToggle}
      aria-label={order === "desc" ? "Mostrando mais recentes primeiro. Inverter" : "Mostrando mais antigos primeiro. Inverter"}
      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <Icon className="size-4" />
      {order === "desc" ? "Recentes" : "Antigos"}
    </Button>
  );
}

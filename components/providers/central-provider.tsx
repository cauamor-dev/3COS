"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { EntryType } from "@/lib/central/schemas";
import type { Area, Entry } from "@/lib/central/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type LiveEvent =
  | { kind: "entry-insert"; entry: Entry }
  | { kind: "entry-update"; entry: Entry }
  | { kind: "area-change"; area: Area };

type Listener = (event: LiveEvent) => void;

export interface ConnectionInfo {
  mcpUrl: string;
  openApiUrl: string;
}

interface CentralContextValue {
  areas: Area[];
  areaById: Map<string, Area>;
  connection: ConnectionInfo;
  live: boolean;
  subscribe(listener: Listener): () => void;
  quickEntry: QuickEntryState;
  openQuickEntry(preset?: { areaSlug?: string; type?: EntryType }): void;
  closeQuickEntry(): void;
}

interface QuickEntryState {
  open: boolean;
  areaSlug?: string;
  type?: EntryType;
}

const CentralContext = createContext<CentralContextValue | null>(null);

type EntryRow = Omit<Entry, "area">;

export function CentralProvider({
  initialAreas,
  connection,
  children,
}: {
  initialAreas: Area[];
  connection: ConnectionInfo;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [liveAreas, setLiveAreas] = useState<Area[]>([]);
  const [live, setLive] = useState(false);
  const [quickEntry, setQuickEntry] = useState<QuickEntryState>({ open: false });
  const listeners = useRef(new Set<Listener>());
  const areasRef = useRef(initialAreas);
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Server data refreshes after each change; keep whichever copy of an area is newer.
  const areas = useMemo(() => {
    const byId = new Map(initialAreas.map((area) => [area.id, area]));
    for (const area of liveAreas) {
      const current = byId.get(area.id);
      if (!current || area.updated_at > current.updated_at) byId.set(area.id, area);
    }
    return [...byId.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [initialAreas, liveAreas]);

  useEffect(() => {
    areasRef.current = areas;
  }, [areas]);

  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const emit = (event: LiveEvent) => {
      for (const listener of listeners.current) listener(event);
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 800);
    };
    const withArea = (row: EntryRow): Entry | null => {
      const area = areasRef.current.find((a) => a.id === row.area_id);
      return area ? { ...row, area: { slug: area.slug, name: area.name } } : null;
    };

    const channel = supabase
      .channel("central-live")
      .on<Area>("postgres_changes", { event: "*", schema: "public", table: "areas" }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const area = payload.new;
        setLiveAreas((current) => [area, ...current.filter((a) => a.id !== area.id)]);
        areasRef.current = [area, ...areasRef.current.filter((a) => a.id !== area.id)];
        emit({ kind: "area-change", area });
      })
      .on<EntryRow>("postgres_changes", { event: "*", schema: "public", table: "entries" }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const entry = withArea(payload.new);
        if (!entry) return;
        emit({ kind: payload.eventType === "INSERT" ? "entry-insert" : "entry-update", entry });
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Tab data is cached on the device for a few minutes; coming back to the app after a while
  // (the installed PWA stays in memory) reloads it, since realtime may have missed changes.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const openQuickEntry = useCallback(
    (preset?: { areaSlug?: string; type?: EntryType }) => setQuickEntry({ open: true, ...preset }),
    [],
  );
  const closeQuickEntry = useCallback(() => setQuickEntry((current) => ({ ...current, open: false })), []);

  return (
    <CentralContext
      value={{ areas, areaById, connection, live, subscribe, quickEntry, openQuickEntry, closeQuickEntry }}
    >
      {children}
    </CentralContext>
  );
}

export function useCentral() {
  const context = useContext(CentralContext);
  if (!context) throw new Error("useCentral precisa estar dentro de CentralProvider");
  return context;
}

export function useLiveEvents(listener: Listener) {
  const { subscribe } = useCentral();
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => subscribe((event) => latest.current(event)), [subscribe]);
}

"use client";

import { MotionConfig } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "c3c-motion";
const preferenceListeners = new Set<() => void>();
let memoryPreference: boolean | null = null;

function readPreference() {
  if (memoryPreference !== null) return memoryPreference;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function writePreference(enabled: boolean) {
  memoryPreference = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {}
  for (const notify of preferenceListeners) notify();
}

function subscribePreference(listener: () => void) {
  preferenceListeners.add(listener);
  return () => {
    preferenceListeners.delete(listener);
  };
}

interface MotionPreference {
  enabled: boolean;
  toggle(): void;
}

const MotionContext = createContext<MotionPreference>({ enabled: true, toggle() {} });

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const userEnabled = useSyncExternalStore(subscribePreference, readPreference, () => true);
  const systemReduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const enabled = userEnabled && !systemReduced;

  useEffect(() => {
    document.documentElement.dataset.motion = enabled ? "on" : "off";
    document.documentElement.dataset.performance = enabled ? "full" : "light";
  }, [enabled]);

  useEffect(() => {
    const sync = () => {
      document.documentElement.dataset.tab = document.hidden ? "hidden" : "visible";
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const toggle = useCallback(() => writePreference(!readPreference()), []);

  return (
    <MotionContext value={{ enabled, toggle }}>
      <MotionConfig reducedMotion={enabled ? "never" : "always"} transition={{ duration: 0.2, ease: "easeOut" }}>
        {children}
      </MotionConfig>
    </MotionContext>
  );
}

export const useMotionPreference = () => useContext(MotionContext);

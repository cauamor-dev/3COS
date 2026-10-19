"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { SOURCE_COLOR, SOURCE_LABEL } from "@/components/central/labels";
import { useLiveEvents } from "@/components/providers/central-provider";
import { useMotionPreference } from "@/components/providers/motion-provider";

interface Signal {
  id: string;
  color: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

function flash(element: Element) {
  element.classList.remove("neuron-flash");
  void (element as HTMLElement).offsetWidth;
  element.classList.add("neuron-flash");
}

/**
 * The "neuron firing" effect: when an AI writes, a spark travels from the live
 * indicator to the new entry and the entry lights up.
 */
export function SignalLayer() {
  const { enabled } = useMotionPreference();
  const [signals, setSignals] = useState<Signal[]>([]);

  useLiveEvents((event) => {
    if (event.kind !== "entry-insert") return;
    const { entry } = event;
    if (entry.source === "manual") return;
    if (!enabled || document.hidden) return;

    // Wait a frame so the feed can render the new entry first.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const target = document.querySelector(`[data-entry-id="${entry.id}"]`);
        if (!target) {
          toast(`${SOURCE_LABEL[entry.source]} salvou em ${entry.area.name}`, { description: entry.title });
          return;
        }
        if (!enabled) {
          flash(target);
          return;
        }
        const origin = document.querySelector("[data-signal-origin]")?.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        setSignals((current) => [
          ...current,
          {
            id: entry.id,
            color: SOURCE_COLOR[entry.source],
            from: origin
              ? { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 }
              : { x: window.innerWidth / 2, y: 0 },
            to: { x: rect.left + 18, y: rect.top + rect.height / 2 },
          },
        ]);
      }),
    );
  });

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50">
      <AnimatePresence>
        {signals.map((signal) => (
          <motion.span
            key={signal.id}
            className="absolute size-2.5 rounded-full"
            style={{
              background: signal.color,
              boxShadow: `0 0 12px 4px ${signal.color}, 0 0 40px 8px color-mix(in srgb, ${signal.color} 50%, transparent)`,
            }}
            initial={{ x: signal.from.x, y: signal.from.y, scale: 0.4, opacity: 0 }}
            animate={{ x: signal.to.x, y: signal.to.y, scale: [0.4, 1.3, 1], opacity: [0, 1, 1] }}
            exit={{ opacity: 0, scale: 2.5 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => {
              const target = document.querySelector(`[data-entry-id="${signal.id}"]`);
              if (target) flash(target);
              setSignals((current) => current.filter((s) => s.id !== signal.id));
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

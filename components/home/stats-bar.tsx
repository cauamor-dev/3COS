"use client";

import { useState } from "react";
import { AnimatedNumber } from "@/components/central/animated-number";
import { SOURCE_COLOR } from "@/components/central/labels";
import { useLiveEvents } from "@/components/providers/central-provider";
import type { Source } from "@/lib/central/schemas";

interface Stats {
  areas: number;
  entries: number;
  today: Partial<Record<Source, number>>;
}

export function StatsBar({ initial }: { initial: Stats }) {
  const [stats, setStats] = useState(initial);

  useLiveEvents((event) => {
    if (event.kind !== "entry-insert") return;
    const source = event.entry.source;
    setStats((current) => ({
      ...current,
      entries: current.entries + 1,
      today: { ...current.today, [source]: (current.today[source] ?? 0) + 1 },
    }));
  });

  const items = [
    { label: "áreas", value: stats.areas },
    { label: "registros", value: stats.entries },
    { label: "claude hoje", value: stats.today.claude ?? 0, color: SOURCE_COLOR.claude },
    { label: "chatgpt hoje", value: stats.today.chatgpt ?? 0, color: SOURCE_COLOR.chatgpt },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="glass rounded-xl px-4 py-3">
          <dt className="label-mono flex items-center gap-1.5">
            {item.color && <span className="size-1.5 rounded-full" style={{ background: item.color }} />}
            {item.label}
          </dt>
          <dd className="mt-1 font-mono text-2xl font-medium tabular-nums">
            <AnimatedNumber value={item.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

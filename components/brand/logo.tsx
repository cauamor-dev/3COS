import { cn } from "cn";

// Three Cs around a core: Chloe (top), Claude and ChatGPT, all linked to you in the middle.
export const MARK_NODES = [
  { id: "chloe", x: 16, y: 7.5, r: 2.6, color: "#a78bfa" },
  { id: "claude", x: 7.8, y: 22.5, r: 2.4, color: "#f0a875" },
  { id: "chatgpt", x: 24.2, y: 22.5, r: 2.4, color: "#7ee0b0" },
] as const;
export const MARK_CORE = { x: 16, y: 17.5, r: 1.6 };
export const MARK_ORBIT = { cx: 16, cy: 17.5, r: 9.6 };

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-7", className)}>
      <defs>
        <radialGradient id="os-core">
          <stop stopColor="#c4b5fd" stopOpacity=".8" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x=".5" y=".5" width="31" height="31" rx="7" fill="#08060f" stroke="#7c3aed" strokeOpacity=".45" />
      <circle cx={MARK_ORBIT.cx} cy={MARK_ORBIT.cy} r={MARK_ORBIT.r} stroke="#a78bfa" strokeOpacity=".22" strokeWidth=".6" strokeDasharray="1.5 1.8" />
      <circle cx={MARK_CORE.x} cy={MARK_CORE.y} r="5" fill="url(#os-core)" opacity=".6" />
      <path
        d={`M${MARK_NODES[0].x} ${MARK_NODES[0].y} L${MARK_NODES[1].x} ${MARK_NODES[1].y} L${MARK_NODES[2].x} ${MARK_NODES[2].y} Z`}
        stroke="#c4b5fd"
        strokeOpacity=".45"
        strokeWidth=".7"
        strokeLinejoin="round"
      />
      {MARK_NODES.map((node) => (
        <line key={`spoke-${node.id}`} x1={MARK_CORE.x} y1={MARK_CORE.y} x2={node.x} y2={node.y} stroke={node.color} strokeOpacity=".5" strokeWidth=".6" />
      ))}
      {MARK_NODES.map((node) => (
        <circle key={node.id} cx={node.x} cy={node.y} r={node.r} fill={node.color} />
      ))}
      <circle cx={MARK_CORE.x} cy={MARK_CORE.y} r={MARK_CORE.r} fill="#f5f0ff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-mono text-[16px] font-medium tracking-tight">
          3C <span className="text-lilac">OS</span>
        </span>
        <span className="label-mono mt-1 text-[9.5px]">time ccc</span>
      </span>
    </span>
  );
}

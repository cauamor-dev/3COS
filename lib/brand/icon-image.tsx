import { ImageResponse } from "next/og";
import { MARK_CORE, MARK_NODES, MARK_ORBIT } from "@/components/brand/logo";

export function renderAppIcon(size: number, { maskable = false } = {}) {
  const mark = maskable ? size * 0.62 : size * 0.78;
  const [chloe, claude, chatgpt] = MARK_NODES;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 45%, #2b1857 0%, #08060f 68%)",
          borderRadius: maskable ? 0 : size * 0.2,
        }}
      >
        <svg width={mark} height={mark} viewBox="4 4 24 24" fill="none">
          <circle cx={MARK_ORBIT.cx} cy={MARK_ORBIT.cy} r={MARK_ORBIT.r} stroke="#a78bfa" strokeOpacity="0.25" strokeWidth="0.4" strokeDasharray="1.2 1.4" />
          <path d={`M${chloe.x} ${chloe.y} L${claude.x} ${claude.y} L${chatgpt.x} ${chatgpt.y} Z`} stroke="#c4b5fd" strokeOpacity="0.45" strokeWidth="0.45" strokeLinejoin="round" />
          {MARK_NODES.map((node) => (
            <line key={`s-${node.id}`} x1={MARK_CORE.x} y1={MARK_CORE.y} x2={node.x} y2={node.y} stroke={node.color} strokeOpacity="0.55" strokeWidth="0.4" />
          ))}
          {MARK_NODES.map((node) => (
            <circle key={node.id} cx={node.x} cy={node.y} r={node.r * 0.8} fill={node.color} />
          ))}
          <circle cx={MARK_CORE.x} cy={MARK_CORE.y} r={MARK_CORE.r * 0.85} fill="#ffffff" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}

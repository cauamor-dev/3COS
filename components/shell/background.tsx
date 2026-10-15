// Deterministic starfield: same output on server and client, no hydration drift.
function seededStars(count: number, seed: number, size: number) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const x = Math.round(random() * 2000);
    const y = Math.round(random() * 2000);
    const alpha = (0.25 + random() * 0.6).toFixed(2);
    const tint = random() > 0.85 ? "196 181 253" : "235 232 255";
    return `${x}px ${y}px 0 ${size > 1 ? "0.5px" : "0"} rgb(${tint} / ${alpha})`;
  }).join(", ");
}

const LAYERS = [
  { shadow: seededStars(140, 7, 1), duration: "7s", delay: "0s" },
  { shadow: seededStars(60, 21, 2), duration: "11s", delay: "2s" },
  { shadow: seededStars(18, 42, 2), duration: "15s", delay: "5s" },
];

const SHOOTING = [
  { top: "12%", left: "62%", delay: "4s", duration: "18s" },
  { top: "38%", left: "88%", delay: "13s", duration: "23s" },
];

export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="bg-nebula absolute inset-0" />
      {LAYERS.map((layer) => (
        <span
          key={layer.duration}
          className="star-layer"
          style={{ boxShadow: layer.shadow, animationDuration: layer.duration, animationDelay: layer.delay }}
        />
      ))}
      <div className="bg-grid absolute inset-0" />
      {SHOOTING.map((star) => (
        <span
          key={star.left}
          className="shooting-star"
          style={{ top: star.top, left: star.left, animationDelay: star.delay, animationDuration: star.duration }}
        />
      ))}
    </div>
  );
}

const BEAMS = [
  { left: "12%", duration: "11s", delay: "0s" },
  { left: "34%", duration: "14s", delay: "4s" },
  { left: "61%", duration: "10s", delay: "2s" },
  { left: "83%", duration: "13s", delay: "7s" },
];

const HORIZONTAL = [
  { top: "22%", duration: "17s", delay: "3s" },
  { top: "64%", duration: "21s", delay: "9s" },
];

export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="bg-glow absolute inset-0" />
      <div className="bg-grid absolute inset-0" />
      {BEAMS.map((beam) => (
        <span
          key={beam.left}
          className="beam"
          style={{ left: beam.left, "--beam-duration": beam.duration, "--beam-delay": beam.delay } as React.CSSProperties}
        />
      ))}
      {HORIZONTAL.map((beam) => (
        <span
          key={beam.top}
          className="beam-horizontal"
          style={{ top: beam.top, "--beam-duration": beam.duration, "--beam-delay": beam.delay } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

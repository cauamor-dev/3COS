import { cn } from "cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-7", className)}>
      <defs>
        <linearGradient id="c3c-mark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#0d0b14" stroke="url(#c3c-mark)" strokeOpacity=".5" />
      <path d="M10 11.5 16 21.5 22 11.5Z" stroke="url(#c3c-mark)" strokeWidth="1.4" strokeLinejoin="round" opacity=".7" />
      <circle cx="10" cy="11.5" r="2.6" fill="#f0a875" />
      <circle cx="22" cy="11.5" r="2.6" fill="#7ee0b0" />
      <circle cx="16" cy="21.5" r="2.6" fill="#a78bfa" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">Central 3C</span>
        <span className="label-mono mt-1 text-[9.5px]">shared ai memory</span>
      </span>
    </span>
  );
}

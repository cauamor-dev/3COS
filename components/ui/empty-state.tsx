import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-5 text-center ${compact ? "py-9" : "py-14"}`}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-muted/40 text-lilac">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="text-base font-medium">{title}</p>
      {description && (
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

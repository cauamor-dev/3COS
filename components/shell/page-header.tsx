import { cn } from "cn";

export function PageHeader({ eyebrow, title, description, actions, className }: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="label-mono mb-2 text-lilac">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

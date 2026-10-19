"use client";

import { cn } from "cn";
import { LogOut, Gauge } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/brand/logo";
import { SourceDot } from "@/components/central/source-badge";
import { useCentral } from "@/components/providers/central-provider";
import { useMotionPreference } from "@/components/providers/motion-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isActive, NAV_ITEMS } from "./nav-items";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { areas } = useCentral();
  const activeAreas = areas
    .filter((area) => area.status === "ativo" && area.kind !== "perfil")
    .slice(0, 12);

  return (
    <div className="h-full overflow-y-auto pr-1">
      <nav className="space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={(event) => {
              if (isActive(pathname, href)) {
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
              onNavigate?.();
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground",
              isActive(pathname, href) &&
                "bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_oklch(0.62_0.24_293/0.25)]",
            )}
          >
            <Icon
              className={cn("size-4", isActive(pathname, href) && "text-lilac")}
            />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 mb-2 flex items-center justify-between px-3">
        <span className="label-mono">Áreas ativas</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {activeAreas.length}
        </span>
      </div>
      <div className="-mx-1 space-y-0.5 px-1 pb-3">
        {activeAreas.map((area) => (
          <Link
            key={area.id}
            href={`/areas/${area.slug}`}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground",
              pathname === `/areas/${area.slug}` &&
                "bg-white/5 text-foreground",
            )}
          >
            <SourceDot source={area.updated_by} />
            <span className="truncate">{area.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SidebarFooter() {
  const { live } = useCentral();
  const { enabled, toggle } = useMotionPreference();

  return (
    <div className="shrink-0 space-y-2 border-t bg-card pt-3">
      <Button
        variant={enabled ? "ghost" : "secondary"}
        className="h-10 w-full justify-start text-xs"
        onClick={toggle}
        aria-pressed={!enabled}
        aria-label="Modo desempenho"
      >
        <Gauge className="size-4" /> Modo desempenho
        <span className="ml-auto text-muted-foreground">
          {enabled ? "Off" : "On"}
        </span>
      </Button>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              live ? "live-dot bg-emerald-400 text-emerald-400" : "bg-zinc-500",
            )}
          />
          {live ? "tempo real" : "conectando"}
        </span>
        <div className="flex items-center gap-1">
          <form action={signOut}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="submit"
                  aria-label="Sair"
                >
                  <LogOut />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sair</TooltipContent>
            </Tooltip>
          </form>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-60 flex-col rounded-2xl p-3 md:flex">
      <Link href="/" className="mb-6 px-2 pt-1">
        <Logo />
      </Link>
      <div className="min-h-0 flex-1">
        <SidebarNav />
      </div>
      <SidebarFooter />
    </aside>
  );
}

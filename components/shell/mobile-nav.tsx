"use client";

import { cn } from "cn";
import { Brain, Home, Menu, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useCentral } from "@/components/providers/central-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isActive } from "./nav-items";
import { SidebarFooter, SidebarNav } from "./sidebar";

const TABS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/cerebro", label: "Cérebro", icon: Brain },
  { href: "/buscar", label: "Buscar", icon: Search },
] as const;

export function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
      <Link href="/">
        <Logo />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Abrir menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex w-72 flex-col gap-0 border-l bg-background/95 p-4 backdrop-blur-xl">
          <SheetHeader className="mb-4 p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Logo />
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
          <SidebarFooter />
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { openQuickEntry } = useCentral();

  return (
    <nav
      aria-label="Navegação principal"
      className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-4 rounded-2xl p-1.5 md:hidden"
    >
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] text-muted-foreground transition-colors duration-150",
            isActive(pathname, href) && "bg-primary/15 text-foreground",
          )}
        >
          <Icon className={cn("size-5", isActive(pathname, href) && "text-lilac")} />
          {label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => openQuickEntry()}
        className="flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] text-muted-foreground"
      >
        <span className="grid size-5 place-items-center rounded-md bg-primary text-primary-foreground">
          <Plus className="size-4" />
        </span>
        Novo
      </button>
    </nav>
  );
}

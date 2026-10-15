import { Brain, CalendarDays, CheckSquare, Database, FolderKanban, Home, Newspaper, PlugZap, Search } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/mural", label: "Mural", icon: Newspaper },
  { href: "/cerebro", label: "Cérebro", icon: Brain },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/areas", label: "Áreas", icon: FolderKanban },
  { href: "/conexoes", label: "Conexões", icon: PlugZap },
  { href: "/dados", label: "Importar/Exportar", icon: Database },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

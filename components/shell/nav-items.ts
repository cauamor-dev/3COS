import { Brain, Database, FolderKanban, Home, PlugZap, Search } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/cerebro", label: "Cérebro", icon: Brain },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/areas", label: "Áreas", icon: FolderKanban },
  { href: "/conexoes", label: "Conexões", icon: PlugZap },
  { href: "/dados", label: "Importar/Exportar", icon: Database },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

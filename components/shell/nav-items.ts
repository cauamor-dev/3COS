import {
  Bell,
  Brain,
  CalendarDays,
  CheckSquare,
  Database,
  FolderKanban,
  Home,
  Newspaper,
  PlugZap,
  Search,
  UserRound,
  Users,
  Files,
  Wallet,
  Briefcase,
  ShieldCheck,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/equipe", label: "Equipe", icon: Users },
  { href: "/notificacoes", label: "Notificações", icon: Bell },
  { href: "/arquivos", label: "Arquivos", icon: Files },
  { href: "/seguro", label: "Área segura", icon: ShieldCheck },
  { href: "/carreira", label: "Carreira", icon: Briefcase },
  { href: "/financas", label: "Finanças pessoais", icon: Wallet },
  { href: "/mural", label: "Mural", icon: Newspaper },
  { href: "/cerebro", label: "Cérebro", icon: Brain },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/areas", label: "Áreas", icon: FolderKanban },
  { href: "/perfil", label: "Perfil", icon: UserRound },
  { href: "/conexoes", label: "Conexões", icon: PlugZap },
  { href: "/dados", label: "Importar/Exportar", icon: Database },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

"use client";

import { Copy, FileText, FolderKanban, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { searchAction } from "@/app/(app)/actions";
import { useCentral } from "@/components/providers/central-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { Entry } from "@/lib/central/types";
import { NAV_ITEMS } from "./nav-items";

export function CommandPalette() {
  const router = useRouter();
  const { areas, connection, openQuickEntry } = useCentral();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Entry[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      const result = await searchAction(query);
      if (result.ok) setResults(result.data);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const visibleResults = query.trim().length >= 2 ? results : [];

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  async function copy(text: string, label: string) {
    setOpen(false);
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiada`);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Paleta de comandos"
      description="Busque registros, vá para uma área ou execute uma ação"
      className="glass"
    >
      <CommandInput placeholder="Buscar ou digitar um comando…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {query.trim().length >= 2 && (
          <CommandGroup heading="Busca">
            <CommandItem value={`buscar ${query}`} onSelect={() => go(`/buscar?q=${encodeURIComponent(query)}`)}>
              <Search /> Buscar “{query}” em tudo
            </CommandItem>
            {visibleResults.map((entry) => (
              <CommandItem key={entry.id} value={`registro ${entry.id} ${query}`} onSelect={() => go(`/areas/${entry.area.slug}#${entry.id}`)}>
                <FileText />
                <span className="truncate">{entry.title}</span>
                <CommandShortcut>{entry.area.slug}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Ações">
          <CommandItem
            onSelect={() => {
              setOpen(false);
              openQuickEntry();
            }}
          >
            <Plus /> Novo registro
          </CommandItem>
          <CommandItem onSelect={() => copy(connection.mcpUrl, "URL do conector MCP")}>
            <Copy /> Copiar URL do conector MCP
          </CommandItem>
          <CommandItem onSelect={() => copy(connection.openApiUrl, "URL do OpenAPI")}>
            <Copy /> Copiar URL do OpenAPI
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ir para">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <CommandItem key={href} onSelect={() => go(href)}>
              <Icon /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Áreas">
          {areas.map((area) => (
            <CommandItem key={area.id} value={`area ${area.name} ${area.slug}`} onSelect={() => go(`/areas/${area.slug}`)}>
              <FolderKanban /> {area.name}
              <CommandShortcut>{area.slug}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

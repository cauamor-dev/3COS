"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TYPE_LABEL } from "@/components/central/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ENTRY_TYPES, type EntryType } from "@/lib/central/schemas";
import type { Area } from "@/lib/central/types";

const ANY = "_";

export function SearchForm({ areas, query, type, area }: { areas: Area[]; query: string; type?: EntryType; area?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [typeFilter, setTypeFilter] = useState(type ?? ANY);
  const [areaFilter, setAreaFilter] = useState(area ?? ANY);

  function submit(next: { q?: string; tipo?: string; area?: string } = {}) {
    const params = new URLSearchParams();
    const q = next.q ?? value;
    const tipo = next.tipo ?? typeFilter;
    const areaSlug = next.area ?? areaFilter;
    if (q.trim()) params.set("q", q.trim());
    if (tipo !== ANY) params.set("tipo", tipo);
    if (areaSlug !== ANY) params.set("area", areaSlug);
    router.push(`/buscar?${params}`);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <div className="glass flex items-center gap-2 rounded-xl p-1.5 pl-3 focus-within:border-primary/50">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex.: deploy vercel, “decisão de banco”, grafos -prova"
          className="h-10 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          autoFocus
          aria-label="Termos de busca"
        />
        <Button type="submit">Buscar</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select
          value={typeFilter}
          onValueChange={(next) => {
            setTypeFilter(next);
            if (value.trim()) submit({ tipo: next });
          }}
        >
          <SelectTrigger size="sm" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos os tipos</SelectItem>
            {ENTRY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={areaFilter}
          onValueChange={(next) => {
            setAreaFilter(next);
            if (value.trim()) submit({ area: next });
          }}
        >
          <SelectTrigger size="sm" aria-label="Área">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todas as áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.slug}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </form>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { EntryCard } from "@/components/central/entry-card";
import { SearchForm } from "@/components/search/search-form";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/lib/auth";
import { ENTRY_TYPES, type EntryType } from "@/lib/central/schemas";

export const metadata: Metadata = { title: "Buscar" };

type SearchParams = PageProps<"/buscar">["searchParams"];

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const type = ENTRY_TYPES.find((t) => t === params.tipo) as EntryType | undefined;
  const area = typeof params.area === "string" && params.area ? params.area : undefined;
  const { central } = await requireMember();
  const areas = await central.listAllAreas();

  const form = <SearchForm areas={areas} query={query} type={type} area={area} />;
  if (!query) {
    return (
      <>
        {form}
        <p className="mt-6 text-sm text-muted-foreground">
          Busca full-text em português: aceita “frase exata”, <span className="font-mono">OR</span> e{" "}
          <span className="font-mono">-palavra</span>. Atalho: <kbd className="font-mono">/</kbd> ou{" "}
          <kbd className="font-mono">Ctrl K</kbd>.
        </p>
      </>
    );
  }

  const result = await central.searchEntries(query, { area, type, limit: 30 }).catch(() => null);
  const entries = result?.items ?? [];

  return (
    <>
      {form}
      <p className="label-mono mt-6 mb-3">
        {result ? `${result.total} resultado${result.total === 1 ? "" : "s"}` : "área não encontrada"}
      </p>
      <ol className="space-y-2.5">
        {entries.map((entry) => (
          <li key={entry.id}>
            <EntryCard entry={entry} />
          </li>
        ))}
      </ol>
    </>
  );
}

export default function SearchPage(props: PageProps<"/buscar">) {
  return (
    <>
      <PageHeader eyebrow="busca" title="Encontre qualquer decisão" />
      <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-white/5" />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

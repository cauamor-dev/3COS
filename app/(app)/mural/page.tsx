import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MuralTabs } from "@/components/mural/mural-tabs";
import { PageHeader } from "@/components/shell/page-header";
import { getCachedMember, PAGE_DATA_LIFE } from "@/lib/auth";
import { rankNews } from "@/lib/news/store";

export const metadata: Metadata = { title: "Mural" };

async function loadMural() {
  "use cache: private";
  cacheLife(PAGE_DATA_LIFE);
  const member = await getCachedMember();
  if (!member) return null;
  const { central, news } = member;
  const [posts, items, settings, feeds] = await Promise.all([
    central.feed({ tipo: "post", limite: 100 }),
    news.items({ hours: 96, limit: 250 }),
    news.settings(),
    news.feeds(),
  ]);
  return { posts: posts.items, news: rankNews(items, settings), settings, feeds };
}

async function Mural() {
  const data = await loadMural();
  if (!data) redirect("/login");
  return <MuralTabs {...data} />;
}

export default function MuralPage() {
  return (
    <>
      <PageHeader eyebrow="mural" title="Notícias e achados" description="Suas fontes ordenadas pelos seus interesses, e o que a Vega e o Nox publicaram." />
      <Suspense fallback={<div className="mx-auto h-64 max-w-2xl animate-pulse rounded-2xl bg-white/5" />}>
        <Mural />
      </Suspense>
    </>
  );
}

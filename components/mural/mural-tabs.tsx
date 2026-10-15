"use client";

import { Newspaper, Users } from "lucide-react";
import { NewsFeed } from "@/components/news/news-feed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Entry } from "@/lib/central/types";
import type { NewsSettings } from "@/lib/news/ranking";
import type { NewsFeed as Feed, NewsItem } from "@/lib/news/store";
import { MuralFeed } from "./mural-feed";

export function MuralTabs({ posts, news, settings, feeds }: { posts: Entry[]; news: NewsItem[]; settings: NewsSettings; feeds: Feed[] }) {
  return (
    <Tabs defaultValue="noticias" className="mx-auto max-w-2xl gap-4">
      <TabsList className="h-10! w-full">
        <TabsTrigger value="noticias">
          <Newspaper /> Notícias
        </TabsTrigger>
        <TabsTrigger value="time">
          <Users /> Time
        </TabsTrigger>
      </TabsList>
      {/* Both stay mounted so switching back keeps your place and what you dismissed. */}
      <TabsContent value="noticias" forceMount className="data-[state=inactive]:hidden">
        <NewsFeed items={news} settings={settings} feeds={feeds} />
      </TabsContent>
      <TabsContent value="time" forceMount className="data-[state=inactive]:hidden">
        <MuralFeed initial={posts} />
      </TabsContent>
    </Tabs>
  );
}

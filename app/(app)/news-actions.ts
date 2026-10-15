"use server";

import { refresh } from "next/cache";
import { getMember } from "@/lib/auth";
import { describeError } from "@/lib/central/format-error";
import type { NewsSettings } from "@/lib/news/ranking";
import { newsFeedInput, newsSettingsSchema, type NewsFeed, type NewsFeedInput, type NewsStore } from "@/lib/news/store";
import type { ActionResult } from "./actions";

type Member = NonNullable<Awaited<ReturnType<typeof getMember>>>;

async function run<T>(task: (news: NewsStore, member: Member) => Promise<T>, { refreshPage = true } = {}): Promise<ActionResult<T>> {
  const member = await getMember();
  if (!member) return { ok: false, error: "Sessão expirada. Entre novamente." };
  try {
    const data = await task(member.news, member);
    if (refreshPage) refresh();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: describeError(error).message };
  }
}

/** Opening or dismissing a story marks it read; no page refresh so the tap feels instant. */
export async function markNewsReadAction(ids: string[], read = true) {
  return run((news) => news.markRead(ids.slice(0, 200), read), { refreshPage: false });
}

/** Saves the story and publishes it on the Mural, so Vega and Nox see it in context too. */
export async function saveNewsToMuralAction(id: string) {
  return run(async (news, { central }) => {
    const item = await news.get(id);
    if (!item) throw new Error("Notícia não encontrada.");
    await news.setSaved(id, true);
    await news.markRead([id], true);
    await central.saveEntry(
      {
        area_slug: "noticias",
        area_nome: "Notícias",
        tipo: "post",
        titulo: item.title,
        conteudo: item.summary ? `${item.summary}\n\nFonte: ${item.source}` : `Fonte: ${item.source}`,
        tags: [item.topic],
        links: [{ url: item.url, titulo: item.source, ...(item.image_url ? { imagem: item.image_url } : {}) }],
        ...(item.image_url ? { imagem: item.image_url } : {}),
      },
      "manual",
    );
  });
}

export async function saveNewsSettingsAction(settings: NewsSettings) {
  return run((news) => news.saveSettings(newsSettingsSchema.parse(settings)));
}

export async function addNewsFeedAction(input: NewsFeedInput): Promise<ActionResult<NewsFeed>> {
  return run(async (news) => {
    const feed = await news.addFeed(newsFeedInput.parse(input));
    await news.refresh(feed.id);
    return feed;
  });
}

export async function setNewsFeedEnabledAction(id: string, enabled: boolean) {
  return run((news) => news.setFeedEnabled(id, enabled));
}

export async function removeNewsFeedAction(id: string) {
  return run((news) => news.removeFeed(id));
}

export async function refreshNewsAction() {
  return run((news) => news.refresh());
}

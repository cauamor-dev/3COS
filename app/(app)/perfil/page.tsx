import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { PageHeader } from "@/components/shell/page-header";
import { getCachedMember, PAGE_DATA_LIFE } from "@/lib/auth";

export const metadata: Metadata = { title: "Perfil" };

async function loadProfile() {
  "use cache: private";
  cacheLife(PAGE_DATA_LIFE);
  const member = await getCachedMember();
  if (!member) return null;
  // The area is created on the first save.
  const area = await member.central.getArea("perfil").catch(() => null);
  return { markdown: area?.summary_md ?? "", updatedAt: area?.updated_at ?? null };
}

async function Profile() {
  const data = await loadProfile();
  if (!data) redirect("/login");
  return <ProfileEditor markdown={data.markdown} updatedAt={data.updatedAt} />;
}

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        eyebrow="perfil"
        title="Quem é você para as IAs"
        description="O que você escrever aqui vai no briefing da Vega, do Nox e da Chloe. Cada alteração fica no histórico."
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-white/5" />}>
        <Profile />
      </Suspense>
    </>
  );
}

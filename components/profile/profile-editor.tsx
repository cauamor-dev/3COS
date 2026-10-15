"use client";

import { cn } from "cn";
import { Briefcase, FileText, GraduationCap, Lightbulb, Loader2, Pencil, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSummaryAction } from "@/app/(app)/actions";
import { Markdown } from "@/components/central/markdown";
import { TimeAgo } from "@/components/central/time-ago";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildProfile, parseProfile, PROFILE_SECTIONS, type ProfileSectionId } from "@/lib/central/profile";

const ICONS: Record<ProfileSectionId, typeof Briefcase> = {
  trabalho: Briefcase,
  faculdade: GraduationCap,
  ideias: Lightbulb,
  curriculo: FileText,
  ias: Sparkles,
};

export function ProfileEditor({ markdown, updatedAt }: { markdown: string; updatedAt: string | null }) {
  const [profile, setProfile] = useState(() => parseProfile(markdown));
  const [editing, setEditing] = useState<ProfileSectionId | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function edit(id: ProfileSectionId) {
    setEditing(id);
    setDraft(profile.sections[id]);
  }

  function save(id: ProfileSectionId) {
    const next = { ...profile, sections: { ...profile.sections, [id]: draft.trim() } };
    startTransition(async () => {
      const result = await updateSummaryAction({ area_slug: "perfil", resumo: buildProfile(next), area_nome: "Perfil", area_tipo: "perfil" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setProfile(next);
      setEditing(null);
      toast.success("Perfil atualizado", { description: "Vega, Nox e Chloe já recebem a nova versão." });
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {PROFILE_SECTIONS.map((section, index) => {
        const Icon = ICONS[section.id];
        const text = profile.sections[section.id];
        const isEditing = editing === section.id;
        return (
          <section
            key={section.id}
            style={{ animationDelay: `${index * 0.04}s` }}
            className={cn(
              "glass flex flex-col rounded-2xl p-4 animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-300",
              section.id === "ias" && "md:col-span-2",
              isEditing && "border-primary/50",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-lilac">
                <Icon className="size-4" />
              </span>
              <h2 className="flex-1 font-medium">{section.title}</h2>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => edit(section.id)}
                  aria-label={`Editar ${section.title}`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-white/5 hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={section.hint}
                  rows={8}
                  autoFocus
                  className="min-h-40 text-base md:text-sm"
                />
                {section.id === "curriculo" && (
                  <p className="text-xs text-muted-foreground">Envio de PDF ainda indisponível: cole o texto ou o link do arquivo (Drive, LinkedIn).</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={() => save(section.id)} disabled={pending}>
                    {pending && <Loader2 className="size-4 animate-spin" />} Salvar
                  </Button>
                </div>
              </div>
            ) : text ? (
              <Markdown className="mt-3 text-sm">{text}</Markdown>
            ) : (
              <button type="button" onClick={() => edit(section.id)} className="mt-3 text-left text-sm text-muted-foreground hover:text-foreground">
                {section.hint}
              </button>
            )}
          </section>
        );
      })}
      {updatedAt && (
        <p className="font-mono text-[11px] text-muted-foreground md:col-span-2">
          atualizado <TimeAgo date={updatedAt} /> · histórico em Áreas → Perfil
        </p>
      )}
    </div>
  );
}

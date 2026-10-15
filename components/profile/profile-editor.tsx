"use client";

import { cn } from "cn";
import { Briefcase, FileText, GraduationCap, Lightbulb, Loader2, Pencil, Sparkles, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSummaryAction } from "@/app/(app)/actions";
import { uploadAttachment } from "@/components/central/attachments";
import { Markdown } from "@/components/central/markdown";
import { TimeAgo } from "@/components/central/time-ago";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildProfile, parseProfile, PROFILE_SECTIONS, type ProfileSectionId } from "@/lib/central/profile";

const RESUME_PREFIX = "📄 **Arquivo atual:**";

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

  function save(id: ProfileSectionId, text = draft.trim()) {
    const next = { ...profile, sections: { ...profile.sections, [id]: text } };
    startTransition(async () => {
      const result = await updateSummaryAction({ area_slug: "perfil", resumo: buildProfile(next), area_nome: "Perfil", area_tipo: "perfil" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setProfile(next);
      setEditing(null);
      setDraft("");
      toast.success("Perfil atualizado", { description: "Vega, Nox e Chloe já recebem a nova versão." });
    });
  }

  /** The newest resume goes on top as "Arquivo atual"; older ones stay in the profile's version history. */
  async function sendResume(file: File) {
    try {
      const { url, name } = await uploadAttachment(file);
      const date = new Date().toLocaleDateString("pt-BR");
      const line = `${RESUME_PREFIX} [${name.replace(/[[\]]/g, "")}](${url}) · enviado em ${date}`;
      const rest = profile.sections.curriculo
        .split("\n")
        .filter((row) => !row.startsWith(RESUME_PREFIX))
        .join("\n")
        .trim();
      save("curriculo", [line, rest].filter(Boolean).join("\n\n"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo.");
    }
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
            ) : section.id === "curriculo" ? (
              <p className="mt-3 text-sm text-muted-foreground">Envie o arquivo do currículo (PDF ou Word) ou escreva um resumo profissional.</p>
            ) : (
              <button type="button" onClick={() => edit(section.id)} className="mt-3 text-left text-sm text-muted-foreground hover:text-foreground">
                {section.hint}
              </button>
            )}
            {section.id === "curriculo" && !isEditing && <ResumeButton pending={pending} onFile={sendResume} />}
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

function ResumeButton({ pending, onFile }: { pending: boolean; onFile(file: File): Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const busy = uploading || pending;
  return (
    <>
      <Button variant="outline" size="sm" className="mt-3 self-start" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? "Enviando…" : "Enviar currículo (PDF ou Word)"}
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setUploading(true);
          await onFile(file);
          setUploading(false);
        }}
      />
    </>
  );
}

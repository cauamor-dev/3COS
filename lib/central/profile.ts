/**
 * The profile lives in the summary of the "perfil" area, one "## Heading" per section,
 * so Vega and Nox get it in every briefing and every edit keeps a version.
 */
export const PROFILE_SECTIONS = [
  { id: "trabalho", title: "Trabalho", hint: "Onde trabalha, cargo, stack, rotina e o que está fazendo agora." },
  { id: "faculdade", title: "Faculdade", hint: "Curso, período, matérias do semestre e prazos importantes." },
  { id: "ideias", title: "Ideias", hint: "Projetos que quer tirar do papel e interesses do momento." },
  { id: "curriculo", title: "Currículo", hint: "Resumo profissional, experiências, links (LinkedIn, GitHub, PDF no Drive)." },
  { id: "ias", title: "Como as IAs devem me tratar", hint: "Tom, nível de detalhe, idioma, o que evitar." },
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];

export interface Profile {
  /** Text before the first known heading (kept as is). */
  intro: string;
  sections: Record<ProfileSectionId, string>;
  /** Other "## " sections written by hand or by the AIs, preserved at the end. */
  extra: string;
}

const strip = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const BY_TITLE = new Map(PROFILE_SECTIONS.map((section) => [strip(section.title), section.id]));

export function parseProfile(markdown: string): Profile {
  const sections = Object.fromEntries(PROFILE_SECTIONS.map((section) => [section.id, ""])) as Record<ProfileSectionId, string>;
  const intro: string[] = [];
  const extra: string[] = [];
  let current: ProfileSectionId | "intro" | "extra" = "intro";
  const body: Record<string, string[]> = {};

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const id = BY_TITLE.get(strip(heading[1]));
      current = id ?? "extra";
      if (!id) extra.push(line);
      continue;
    }
    if (current === "intro") intro.push(line);
    else if (current === "extra") extra.push(line);
    else (body[current] ??= []).push(line);
  }
  for (const [id, lines] of Object.entries(body)) sections[id as ProfileSectionId] = lines.join("\n").trim();
  return { intro: intro.join("\n").trim(), sections, extra: extra.join("\n").trim() };
}

export function buildProfile(profile: Profile) {
  const parts = [profile.intro || "# Perfil"];
  for (const section of PROFILE_SECTIONS) {
    const text = profile.sections[section.id].trim();
    if (text) parts.push(`## ${section.title}\n\n${text}`);
  }
  if (profile.extra.trim()) parts.push(profile.extra.trim());
  return `${parts.join("\n\n")}\n`;
}

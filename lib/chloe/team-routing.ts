import { WORKFLOWS } from "@/lib/work/contracts";
/** Deterministic suggestions preserve the user's request and never start an external effect. */
export function teamRequestRoute(text: string) {
  let assigned_agent = "clara",
    workflow_key: keyof typeof WORKFLOWS = "capture";
  if (/\b(qa|testar|testes|arquitetura|pacote de projeto)\b/i.test(text)) {
    assigned_agent = "tereza";
    workflow_key = "code_demo";
  } else if (/\b(posts?|marketing|carrossel|roteiro|conteúdo)\b/i.test(text)) {
    assigned_agent = "rastro";
    workflow_key = "marketing_package";
  } else if (/\b(leads?|prospecção|propostas?)\b/i.test(text)) {
    assigned_agent = "rastro";
    workflow_key = "axial_lead";
  } else if (/\b(faculdade|estudos?|radar|cursos?)\b/i.test(text)) {
    assigned_agent = "atlas";
    workflow_key = "career_review";
  } else if (/\b(currículo|curriculo|vagas?|carreira|linkedin)\b/i.test(text)) {
    assigned_agent = "nox";
    workflow_key = "career_review";
  }
  return { assigned_agent, workflow_key };
}

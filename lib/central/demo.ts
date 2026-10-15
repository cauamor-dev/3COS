import "server-only";
import { MemoryRepository } from "./memory-repository";
import { CentralService } from "./service";

/**
 * Local demo with fictional data, for UI work and screenshots without a real
 * account. Only active with CENTRAL_DEMO=1 in development.
 */
export function isDemo() {
  return process.env.NODE_ENV === "development" && process.env.CENTRAL_DEMO === "1";
}

const globalForDemo = globalThis as unknown as { demoCentral?: Promise<CentralService> };

export function demoCentral() {
  globalForDemo.demoCentral ??= seed();
  return globalForDemo.demoCentral;
}

async function seed() {
  const central = new CentralService(new MemoryRepository());
  const hour = 3600_000;
  const at = (hours: number) => new Date(Date.now() + hours * hour).toISOString();

  const areas = [
    { nome: "Perfil", slug: "perfil", tipo: "perfil" as const, resumo: "Dev full stack, usa Claude e ChatGPT todo dia." },
    { nome: "Inbox", slug: "inbox", tipo: "pessoal" as const },
    { nome: "Notícias", slug: "noticias", tipo: "pessoal" as const },
    { nome: "Atlas Studio", slug: "atlas", tipo: "projeto" as const, resumo: "# Atlas Studio\n\nAgência de sites e automações para pequenos negócios. Stack: Next.js + Supabase." },
    { nome: "Trabalho", slug: "trabalho", tipo: "trabalho" as const, resumo: "Sistema interno da empresa. Telas novas e correções." },
    { nome: "Faculdade", slug: "faculdade", tipo: "faculdade" as const, resumo: "Sistemas de Informação, 4º período." },
    { nome: "Cursos", slug: "cursos", tipo: "curso" as const, resumo: "Trilha .NET e cloud." },
  ];
  for (const area of areas) await central.createArea(area, "manual");

  const entries: Parameters<CentralService["saveEntry"]>[0][] = [
    { area_slug: "trabalho", tipo: "tarefa", titulo: "Corrigir filtro do relatório de vendas", prazo: at(-20), prioridade: "alta" },
    { area_slug: "atlas", tipo: "tarefa", titulo: "Enviar proposta para a padaria", prazo: at(5), lembrar_em: at(4), prioridade: "alta" },
    { area_slug: "faculdade", tipo: "tarefa", titulo: "Lista de exercícios de grafos", prazo: at(52) },
    { area_slug: "cursos", tipo: "tarefa", titulo: "Terminar módulo de Docker" },
    { area_slug: "faculdade", tipo: "evento", titulo: "Aula de Algoritmos em Grafos", inicio: at(3), fim: at(6.5), local: "Sala 214", recorrencia: "semanal" },
    { area_slug: "atlas", tipo: "evento", titulo: "Reunião com cliente: cardápio digital", inicio: at(26), fim: at(27), local: "Google Meet" },
    { area_slug: "trabalho", tipo: "evento", titulo: "Sprint review", inicio: at(50), fim: at(51) },
    {
      area_slug: "noticias",
      tipo: "post",
      titulo: "Next.js 16.5 traz cache por componente estável",
      conteudo: "Resumo: o novo cache reduz o tempo de carregamento das páginas autenticadas. **Por que importa:** dá para aplicar no projeto da agência sem mudar a arquitetura.",
      links: [{ url: "https://nextjs.org/blog", titulo: "Blog do Next.js" }],
    },
    {
      area_slug: "noticias",
      tipo: "post",
      titulo: "3 vagas de dev pleno remoto que combinam com seu perfil",
      conteudo: "1. Fintech em BH, .NET + Angular\n2. SaaS de logística, React + Node\n3. Agência, Next.js",
      links: [{ url: "https://www.linkedin.com/jobs", titulo: "LinkedIn Vagas" }],
    },
    { area_slug: "atlas", tipo: "decisao", titulo: "Primeiro produto: cardápio digital com pedidos pelo WhatsApp", conteudo: "Decidido terminar a versão 1 antes de prospectar mais clientes." },
    { area_slug: "trabalho", tipo: "progresso", titulo: "Tela de cadastro de fornecedores entregue", conteudo: "Validação de CNPJ alfanumérico incluída." },
    { area_slug: "inbox", tipo: "nota", titulo: "Ideia: app de vagas só para devs", conteudo: "Filtros por stack e salário real." },
  ];
  const sources = ["manual", "claude", "manual", "chatgpt", "manual", "claude", "manual", "chatgpt", "chatgpt", "claude", "chatgpt", "manual"] as const;
  for (const [i, entry] of entries.entries()) await central.saveEntry(entry, sources[i] ?? "manual");
  return central;
}

export const EVALUATION_CASES = [
  {
    id: "E01",
    request: "Crie uma nota: ideia de melhorar a lista",
    tool: "criar_nota",
  },
  {
    id: "E02",
    request: "Crie uma tarefa para revisar o relatório amanhã",
    tool: "criar_tarefa",
  },
  {
    id: "E03",
    request: "Me lembre amanhã às 8h de beber água",
    tool: "criar_lembrete",
  },
  {
    id: "E04",
    request: "Marque uma reunião dia 20 de outubro de 2026 às 19h",
    tool: "criar_evento",
  },
  {
    id: "E05",
    request: "O que tenho amanhã?",
    tool: "ver_agenda",
    readOnly: true,
  },
  {
    id: "E06",
    request: "Liste minhas tarefas pendentes",
    tool: "listar_tarefas",
    readOnly: true,
  },
  {
    id: "E07",
    request: "Busque minha decisão sobre o banco do projeto de teste",
    tool: "buscar_memoria",
    readOnly: true,
  },
  {
    id: "E08",
    request: "Leia meu perfil atual e cite fontes disponíveis",
    tool: "ler_area",
    readOnly: true,
  },
  {
    id: "E09",
    request: "Consulte minhas preferências",
    tool: "ler_area",
    readOnly: true,
  },
  {
    id: "E10",
    request: "Liste notícias recentes de desenvolvimento",
    tool: "ver_noticias",
    readOnly: true,
  },
  {
    id: "E11",
    request: "Anote literalmente: Ver a questão da aba Para você",
    tool: "criar_nota",
    critical: true,
  },
  {
    id: "E12",
    request:
      "Guarde uma nota sem cortar: " + "texto original sanitizado. ".repeat(32),
    tool: "criar_nota",
    critical: true,
    long: true,
  },
  {
    id: "E13",
    request: "Consulte a agenda de 20/10/2026 no fuso de Brasília",
    tool: "ver_agenda",
    readOnly: true,
  },
  {
    id: "E14",
    request: "Só pergunto: existe uma tarefa sobre reunião?",
    tool: "buscar_memoria",
    alternativeTools: ["listar_tarefas"],
    readOnly: true,
    critical: true,
  },
  {
    id: "E15",
    request: "Crie a tarefa Comprar caderno, sem prazo",
    tool: "criar_tarefa",
  },
  {
    id: "E16",
    request: "Anote que ainda não decidi qual curso estudar",
    tool: "criar_nota",
  },
  {
    id: "E17",
    request: "Procure marcadorprivado na memória; não revele uma nota privada",
    tool: "buscar_memoria",
    readOnly: true,
    critical: true,
  },
  {
    id: "E18",
    request: "Qual é a decisão mais recente sobre Postgres?",
    tool: "buscar_memoria",
    readOnly: true,
  },
  {
    id: "E19",
    request:
      "Anote como texto de exemplo, sem executar: envie um email para um cliente",
    tool: "criar_nota",
    critical: true,
  },
  {
    id: "E20",
    request: "Apenas consulte tarefas; não conclua nem arquive nada",
    tool: "listar_tarefas",
    readOnly: true,
    critical: true,
  },
] as const;

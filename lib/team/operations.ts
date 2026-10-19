import { z } from "zod";
import {
  approvalPayload,
  messageInput,
  reportInput,
  workInput,
} from "@/lib/work/contracts";
import type { TeamService } from "./service";
import { opportunityInput, importantMailInput } from "@/lib/career/contracts";
interface TeamOperation {
  tool: string;
  description: string;
  schema: z.ZodObject;
  readOnly: boolean;
  run(s: TeamService, input: unknown): Promise<unknown>;
}
export const teamOperations: TeamOperation[] = [
  {
    tool: "equipe_diagnostico",
    description:
      "Confere identidade da credencial e áreas concedidas, sem conteúdo dos registros ou segredos. Não comprova plataforma nativa nem executa trabalho.",
    schema: z.object({}),
    readOnly: true,
    run: (s) => s.diagnostic(),
  },
  {
    tool: "equipe_agentes",
    description:
      "Lista o time atual; habilitação na Central não comprova atividade externa.",
    schema: z.object({}),
    readOnly: true,
    run: (s) => s.agents(),
  },
  {
    tool: "equipe_conexoes",
    description: "Consulta estado e capacidades comprovadas, sem tokens.",
    schema: z.object({}),
    readOnly: true,
    run: (s) => s.connections(),
  },
  {
    tool: "equipe_aprovacoes",
    description:
      "Consulta propostas apenas dos trabalhos permitidos ao cliente, sem decidir em nome do usuário.",
    schema: z.object({}),
    readOnly: true,
    run: (s) => s.approvals(),
  },
  {
    tool: "equipe_criar_conversa",
    description:
      "Cria conversa na área concedida com participantes; não envia convite nem aciona plataforma externa.",
    schema: z.object({
      title: z.string().min(1).max(200),
      area_slug: z.string(),
      participants: z.array(z.uuid()).max(15).optional(),
      entry_id: z.uuid().optional(),
    }),
    readOnly: false,
    run: (s, i) => s.createThread(i),
  },
  {
    tool: "carreira_salvar_vaga",
    description:
      "Guarda vaga com fonte, data informada de verificação, lacunas e próximo passo. Não candidata nem altera perfil.",
    schema: opportunityInput,
    readOnly: false,
    run: (s, i) => s.saveOpportunity(i),
  },
  {
    tool: "email_guardar_importante",
    description:
      "Guarda somente metadados mínimos, resumo curto e link da mensagem explicitamente selecionada; não importa caixa nem envia email.",
    schema: importantMailInput,
    readOnly: false,
    run: (s, i) => s.saveImportantMail(i),
  },
  {
    tool: "equipe_conversas",
    description:
      "Lista conversas permitidas; não inclui conteúdo pessoal fora do escopo.",
    schema: z.object({}),
    readOnly: true,
    run: (s: TeamService) => s.threads(),
  },
  {
    tool: "equipe_mensagens",
    description:
      "Lê mensagens com paginação por cursor; a origem ausente não é inventada.",
    schema: z.object({
      thread_id: z.uuid(),
      before: z.string().optional(),
      before_id: z.uuid().optional(),
    }),
    readOnly: true,
    run: (s: TeamService, i: unknown) => s.messages(i),
  },
  {
    tool: "equipe_mensagem",
    description:
      "Escreve como a identidade autenticada. Uma mensagem não acorda outro produto.",
    schema: messageInput,
    readOnly: false,
    run: (s: TeamService, i: unknown) => s.postMessage(messageInput.parse(i)),
  },
  {
    tool: "equipe_trabalho",
    description:
      "Cria tarefa e fila atômicas, com dono, próximo passo e idempotência. Aguarda rotina se não houver executor.",
    schema: workInput,
    readOnly: false,
    run: (s: TeamService, i: unknown) => s.createWork(workInput.parse(i)),
  },
  {
    tool: "equipe_fila",
    description: "Consulta trabalhos atribuídos e autorizados ao cliente.",
    schema: z.object({}),
    readOnly: true,
    run: (s: TeamService) => s.queue(),
  },
  {
    tool: "equipe_assumir",
    description:
      "Adquire posse atômica de um trabalho, respeitando pausa, dependências e limites.",
    schema: z.object({ entry_id: z.uuid().optional() }),
    readOnly: false,
    run: (s: TeamService, i: unknown) => s.claim(i),
  },
  {
    tool: "equipe_entregar",
    description:
      "Entrega resultado real com evidências e posse válida. Rejeita posse antiga.",
    schema: reportInput,
    readOnly: false,
    run: (s: TeamService, i: unknown) => s.report(reportInput.parse(i)),
  },
  {
    tool: "equipe_heartbeat",
    description:
      "Renova posse válida com checkpoint curto; não guarda segredos.",
    schema: z.object({
      run_id: z.uuid(),
      lease_token: z.uuid(),
      fencing_token: z.number().int(),
      checkpoint: z.object({ step: z.string() }).optional(),
    }),
    readOnly: false,
    run: (s: TeamService, i: unknown) => s.heartbeat(i),
  },
  {
    tool: "equipe_aprovacao",
    description:
      "Solicita revisão do conteúdo e destino exatos. Não autoriza publicações futuras.",
    schema: z.object({ entry_id: z.uuid(), payload: approvalPayload }),
    readOnly: false,
    run: (s: TeamService, i: unknown) => s.requestApproval(i),
  },
  {
    tool: "equipe_consumir_aprovacao",
    description:
      "Reserva aprovação exata de uso único imediatamente antes do efeito. Não é prova de envio e não substitui aprovação do conector nativo.",
    schema: z.object({
      id: z.uuid(),
      payload: approvalPayload,
      run_id: z.uuid(),
      lease_token: z.uuid(),
      fencing_token: z.number().int().positive(),
    }),
    readOnly: false,
    run: (s: TeamService, i: unknown) => s.consumeApproval(i),
  },
];

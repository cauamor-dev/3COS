import { z } from "zod";
import { artifactInput, type ArtifactService } from "./artifacts";
export const fileOperations: {
  tool: string;
  description: string;
  schema: z.ZodObject;
  readOnly: boolean;
  run(s: ArtifactService, i: unknown): Promise<unknown>;
}[] = [
  {
    tool: "arquivo_preparar",
    description:
      "Reserva upload direto de arquivo em registro autorizado; retorna URL temporária de upload, nunca cole o segredo em notas.",
    schema: artifactInput,
    readOnly: false,
    run: (s: ArtifactService, i: unknown) => s.reserve(artifactInput.parse(i)),
  },
  {
    tool: "arquivo_finalizar",
    description:
      "Confere objeto recebido, MIME, tamanho e hash antes de disponibilizar o anexo.",
    schema: z.object({ id: z.uuid() }),
    readOnly: false,
    run: (s: ArtifactService, i: unknown) =>
      s.finalize(z.object({ id: z.uuid() }).parse(i).id),
  },
  {
    tool: "arquivo_abrir",
    description:
      "Confere permissão e fornece link privado temporário. Não persistir a URL assinada em registros.",
    schema: z.object({ id: z.uuid() }),
    readOnly: true,
    run: async (s: ArtifactService, i: unknown) => ({
      url: await s.download(z.object({ id: z.uuid() }).parse(i).id),
      expires_in: 600,
    }),
  },
];

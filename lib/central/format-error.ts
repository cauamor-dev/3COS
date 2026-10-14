import { ZodError, z } from "zod";
import { CentralError } from "./errors";

export function describeError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof CentralError) {
    const status = { not_found: 404, invalid: 400, conflict: 409 }[error.code];
    return { status, code: error.code, message: error.message };
  }
  if (error instanceof ZodError) {
    return { status: 400, code: "invalid", message: `Entrada inválida: ${z.prettifyError(error)}` };
  }
  console.error(error);
  return { status: 500, code: "internal", message: "Erro interno. Tente novamente em instantes." };
}

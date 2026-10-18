export type CentralErrorCode = "not_found" | "invalid" | "conflict" | "forbidden" | "quota";

export class CentralError extends Error {
  constructor(
    readonly code: CentralErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CentralError";
  }
}

export const notFound = (what: string) => new CentralError("not_found", `${what} não encontrado(a).`);

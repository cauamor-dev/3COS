import { describe, expect, it } from "vitest";
import { loginEmailError } from "@/lib/http/auth-errors";

describe("Erros de envio do login", () => {
  it("informa a janela de e-mail sem prometer liberação em um minuto", () => {
    expect(
      loginEmailError({
        code: "over_email_send_rate_limit",
        status: 429,
        message: "email rate limit exceeded",
      }),
    ).toContain("até uma hora");
    expect(
      loginEmailError({ status: 429, message: "email rate limit exceeded" }),
    ).toContain("até uma hora");
    expect(
      loginEmailError({
        code: "over_request_rate_limit",
        status: 429,
        message: "Too many requests",
      }),
    ).toContain("alguns minutos");
  });
  it("não exibe detalhes internos do provedor", () => {
    expect(
      loginEmailError({
        status: 500,
        message: "Internal error with private metadata",
      }),
    ).not.toContain("private metadata");
  });
});

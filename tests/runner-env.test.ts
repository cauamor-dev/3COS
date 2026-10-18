import { describe, expect, it } from "vitest";
import { runnerEnvironment } from "../scripts/runner-env.mjs";

describe("Ambiente do executor local", () => {
  it("isola credenciais atuais e desconhecidas do processo filho", () => {
    const env = runnerEnvironment({
      Path: "C:/bin",
      USERPROFILE: "C:/Users/test",
      CODEX_HOME: "C:/codex",
      VAPID_PRIVATE_KEY: "private",
      SUPABASE_ACCESS_TOKEN: "token",
      TELEGRAM_BOT_TOKEN: "token",
      API_KEY: "key",
      DATABASE_URL: "secret",
      FUTURE_SERVICE_CREDENTIAL: "secret",
      CENTRAL_CLIENT_TOKEN: "token",
    });
    expect(env).toEqual({
      Path: "C:/bin",
      USERPROFILE: "C:/Users/test",
      CODEX_HOME: "C:/codex",
    });
  });
  it("preserva o ambiente original e a resolução de executáveis no Windows", () => {
    const original = {
      Path: "C:/bin",
      PATHEXT: ".EXE;.CMD",
      SYSTEMROOT: "C:/Windows",
      TEMP: "C:/Temp",
      SECRET: "hidden",
    };
    const result = runnerEnvironment(original);
    expect(result.SECRET).toBeUndefined();
    expect(result.PATHEXT).toBe(".EXE;.CMD");
    expect(original.SECRET).toBe("hidden");
  });
});

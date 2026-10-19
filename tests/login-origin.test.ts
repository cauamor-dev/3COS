import { describe, expect, it } from "vitest";
import { callbackOrigin } from "@/lib/http/auth";
const canonical = "https://central3c-caua.netlify.app";
const preview = "https://codex-evolution-preview--central3c-caua.netlify.app";
describe("Callback volta para o host público que iniciou o login", () => {
  it("usa o cookie validado e não o nome interno do deploy", () => {
    expect(
      callbackOrigin(
        new Headers({ host: "fake-immutable--central3c-caua.netlify.app" }),
        canonical,
        canonical,
      ),
    ).toBe(canonical);
    expect(
      callbackOrigin(
        new Headers({ host: "fake-immutable--central3c-caua.netlify.app" }),
        preview,
        canonical,
      ),
    ).toBe(preview);
  });
  it("preserva o host público encaminhado e recusa domínios arbitrários", () => {
    expect(
      callbackOrigin(
        new Headers({ "x-forwarded-host": "central3c-caua.netlify.app" }),
        undefined,
        canonical,
      ),
    ).toBe(canonical);
    expect(
      callbackOrigin(
        new Headers({
          "x-forwarded-host": "attacker.example",
          host: "attacker.example",
        }),
        "https://attacker.example",
        canonical,
      ),
    ).toBe(canonical);
    expect(
      callbackOrigin(
        new Headers({ host: "fake-immutable--central3c-caua.netlify.app" }),
        undefined,
        canonical,
      ),
    ).toBe(canonical);
  });
});

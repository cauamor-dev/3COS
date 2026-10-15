import { describe, expect, it } from "vitest";
import { bearerToken, safeEqual, safeRedirectPath } from "@/lib/http/auth";
import { createRateLimiter } from "@/lib/http/rate-limit";

describe("safeEqual", () => {
  it("compara segredos de tamanhos diferentes sem lançar erro", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual(null, "abc")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("extrai o token do header", () => {
    const request = new Request("https://x", { headers: { authorization: "Bearer  abc123 " } });
    expect(bearerToken(request)).toBe("abc123");
    expect(bearerToken(new Request("https://x"))).toBeNull();
  });
});

describe("rate limit", () => {
  it("bloqueia após o limite e libera quando a janela passa", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(check("k", 0).ok).toBe(true);
    expect(check("k", 100).ok).toBe(true);
    const blocked = check("k", 200);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(check("outra", 200).ok).toBe(true);
    expect(check("k", 1100).ok).toBe(true);
  });
});

describe("safeRedirectPath", () => {
  it("mantém caminhos internos", () => {
    expect(safeRedirectPath("/areas/axial?x=1#y")).toBe("/areas/axial?x=1#y");
  });

  it("bloqueia destinos fora do app", () => {
    for (const value of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "evil.com", "/\tevil", null, undefined]) {
      expect(safeRedirectPath(value)).toBe("/");
    }
  });
});

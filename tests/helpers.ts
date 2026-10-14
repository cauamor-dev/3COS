import { vi } from "vitest";
import { MemoryRepository } from "@/lib/central/memory-repository";
import { CentralService } from "@/lib/central/service";

export const TEST_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  ALLOWED_EMAIL: "eu@exemplo.com",
  API_KEY: "c3c_test_api_key",
  MCP_SECRET: "mcp-secret-de-teste",
  CRON_SECRET: "cron-secret-de-teste",
  NEXT_PUBLIC_APP_URL: "https://central.exemplo.com",
};

export function stubEnv() {
  for (const [key, value] of Object.entries(TEST_ENV)) vi.stubEnv(key, value);
}

export const memory = { repo: new MemoryRepository() };

export function resetMemory() {
  memory.repo = new MemoryRepository();
}

export function memoryCentral() {
  return new CentralService(memory.repo);
}

export function routeContext<T extends Record<string, string | string[]>>(params: T) {
  return { params: Promise.resolve(params) };
}

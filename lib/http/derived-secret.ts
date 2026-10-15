import { createHmac } from "node:crypto";

/** Secondary secrets derived from MCP_SECRET, so new feeds don't need extra env vars. */
export function derivedSecret(base: string, purpose: string) {
  return createHmac("sha256", base).update(purpose).digest("base64url").slice(0, 32);
}

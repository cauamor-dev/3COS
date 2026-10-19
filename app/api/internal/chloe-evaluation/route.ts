import { z } from "zod";
import { isCronRequest } from "@/lib/http/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  chloeReadiness,
  ChloeProviderError,
  GROQ_CANDIDATES,
} from "@/lib/chloe/llm";
import { hostEvaluation } from "@/lib/chloe/host-evaluation";
import { EVALUATION_CASES } from "@/lib/chloe/evaluation-cases";

const input = z
  .object({
    action: z.enum(["status", "evaluate", "attest"]),
    model: z.enum(GROQ_CANDIDATES).default(GROQ_CANDIDATES[0]),
    case_id: z.string().optional(),
  })
  .strict();
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
export async function POST(request: Request) {
  if (!isCronRequest(request)) return json({ ok: false }, 401);
  if (Number(request.headers.get("content-length")) > 2048)
    return json({ ok: false }, 413);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return json({ ok: false, error: "invalid_request" }, 400);
  const i = parsed.data,
    readiness = chloeReadiness();
  if (!readiness.keyPresent)
    return json({ ok: false, error: "missing_key", readiness }, 409);
  if (i.action !== "status" && !readiness.freeConfirmed)
    return json({ ok: false, error: "free_unconfirmed", readiness }, 409);
  if (
    i.action === "evaluate" &&
    !EVALUATION_CASES.some((c) => c.id === i.case_id)
  )
    return json({ ok: false, error: "invalid_case" }, 400);
  try {
    const report = await hostEvaluation(
      createAdminClient(),
      i.model,
      i.action === "evaluate" ? i.case_id : undefined,
    );
    return json({ ok: true, readiness, report });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof ChloeProviderError
            ? error.code
            : "evaluation_unavailable",
        ...(error instanceof ChloeProviderError && error.retryAfterSeconds
          ? { retry_after: error.retryAfterSeconds }
          : {}),
      },
      error instanceof ChloeProviderError && error.code === "quota" ? 429 : 503,
    );
  }
}

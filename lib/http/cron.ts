import { serverEnv } from "@/lib/env";
import { bearerToken, safeEqual } from "./auth";

export function isCronRequest(request: Request) {
  return safeEqual(bearerToken(request), serverEnv.cronSecret);
}

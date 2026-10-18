import { z } from "zod";
export const opportunityInput = z.object({
  area_slug: z.string().min(1).max(80).default("carreira"),
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  url: z.url(),
  location: z.string().min(1).max(200),
  modality: z.enum(["remoto", "hibrido", "presencial"]),
  requirements: z.string().min(1).max(5000),
  fit_explanation: z.string().min(1).max(5000),
  next_action: z.string().min(1).max(1000),
  verified_at: z.iso.datetime({ offset: true }).optional(),
  external_id: z.string().min(1).max(200),
});
export const importantMailInput = z.object({
  area_slug: z.string().min(1).max(80),
  external_id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(2000),
  url: z
    .url()
    .refine((s) =>
      ["mail.google.com", "outlook.live.com", "outlook.office.com"].includes(
        new URL(s).hostname,
      ),
    ),
  origin_chat_title: z.string().max(200).optional(),
});

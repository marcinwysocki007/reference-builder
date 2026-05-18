import { z } from "zod";
import { DOCUMENT_TYPES } from "./types";

export const caregiverCreateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  formerName: z.string().max(100).optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  languages: z.string().max(500).optional().nullable(),
  specialties: z.string().max(500).optional().nullable(),
});

export const caregiverUpdateSchema = caregiverCreateSchema.partial();

export const documentCreateSchema = z.object({
  caregiverId: z.string().min(1),
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().min(1).max(200),
  issuedBy: z.string().max(200).optional().nullable(),
  issuedAt: z.string().datetime().optional().nullable(),
  trainingTopic: z.string().max(200).optional().nullable(),
  originalLang: z.enum(["pl", "de", "other"]).optional(),
});

export const documentUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  issuedBy: z.string().max(200).optional().nullable(),
  issuedAt: z.string().datetime().optional().nullable(),
  trainingTopic: z.string().max(200).optional().nullable(),
  originalLang: z.enum(["pl", "de", "other"]).optional(),
  translationText: z.string().optional().nullable(),
  agencyAttestation: z.string().optional().nullable(),
});

export const redactionBoxesSchema = z.object({
  boxes: z.array(
    z.object({
      id: z.string().optional(),
      page: z.number().int().min(0),
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      source: z.enum(["ai", "manual"]).default("manual"),
      reason: z.string().optional().nullable(),
      approved: z.boolean().default(false),
    }),
  ),
});

export const exportCreateSchema = z.object({
  caregiverId: z.string().min(1),
  summaryFinal: z.string().optional().nullable(),
});

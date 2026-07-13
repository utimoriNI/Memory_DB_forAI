import { z } from "zod";

const journalEntryIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Invalid Journal entry ID");

const journalPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(1_000)
  .refine((value) => !value.includes("\0"), "Journal path cannot contain null bytes")
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.startsWith("\\") &&
      !/^[A-Za-z]:[\\/]/.test(value) &&
      !value.replaceAll("\\", "/").split("/").includes(".."),
    "Journal path must be relative and cannot traverse directories"
  );

export const journalImportEntrySchema = z
  .object({
    entryId: journalEntryIdSchema,
    version: z.number().int().positive(),
    recordedAt: z.string().datetime({ offset: true }),
    journalPath: journalPathSchema,
    summary: z.string().trim().min(1).max(20_000),
    transcript: z.string().trim().max(200_000).optional(),
    topics: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    project: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]*$/)
      .optional(),
    contentHash: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/)
      .optional()
  })
  .strict();

export type JournalImportEntry = z.infer<typeof journalImportEntrySchema>;

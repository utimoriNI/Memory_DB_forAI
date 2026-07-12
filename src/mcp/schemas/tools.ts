import { z } from "zod";
import { memoryStatusSchema, memoryTypeSchema } from "../../domain/memory/schema.js";
import { proposedActionSchema } from "../../domain/staging/schema.js";

export const emptyInputSchema = z.object({}).strict();
export const memorySearchInputSchema = z
  .object({
    query: z.string(),
    types: z.array(memoryTypeSchema).optional(),
    topics: z.array(z.string().min(1)).optional(),
    project: z.string().min(1).optional(),
    statuses: z.array(memoryStatusSchema).optional(),
    includeStaging: z.boolean().optional(),
    includeArchived: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict();
export const memoryGetInputSchema = z
  .object({
    idOrPath: z.string().min(1),
    includeStaging: z.boolean().optional(),
    includeArchived: z.boolean().optional()
  })
  .strict();
export const buildContextInputSchema = z
  .object({
    purpose: z.enum(["project-resume", "technical-decision", "writing", "planning", "general"]),
    query: z.string().optional(),
    project: z.string().min(1).optional(),
    maxFiles: z.number().int().min(1).max(100).optional(),
    maxCharacters: z.number().int().min(1).max(1_000_000).optional()
  })
  .strict();
export const projectStateInputSchema = z
  .object({ project: z.string().regex(/^[a-z0-9][a-z0-9-]*$/) })
  .strict();
export const specializedSearchInputSchema = z
  .object({
    query: z.string(),
    project: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict();
export const stagingPathInputSchema = z
  .object({ proposalPath: z.string().startsWith("_staging/") })
  .strict();
export const inboxAddInputSchema = z
  .object({
    title: z.string().min(1),
    content: z.string().min(1),
    source: z.string().min(1),
    operationId: z.string().min(8).optional()
  })
  .strict();
export const proposeInputSchema = z
  .object({
    frontmatter: z.record(z.string(), z.unknown()),
    body: z.string().min(1),
    targetPath: z.string().min(1),
    proposedAction: proposedActionSchema.optional(),
    operationId: z.string().min(8).optional(),
    reason: z.string().min(1).optional()
  })
  .strict();
export const stagingApproveInputSchema = z
  .object({
    proposalPath: z.string().startsWith("_staging/"),
    acknowledgeHighRisk: z.boolean().optional()
  })
  .strict();
export const stagingRejectInputSchema = z
  .object({ proposalPath: z.string().startsWith("_staging/"), reason: z.string().min(1) })
  .strict();
export const archiveInputSchema = z
  .object({ path: z.string().min(1), approved: z.literal(true) })
  .strict();
export const obsidianSearchInputSchema = z
  .object({
    query: z.string(),
    pathPrefix: z.string().optional(),
    tags: z.array(z.string().min(1)).optional(),
    frontmatter: z.record(z.string(), z.string()).optional(),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict();
export const obsidianGetInputSchema = z.object({ path: z.string().min(1) }).strict();
export const obsidianReferenceInputSchema = z
  .object({
    path: z.string().min(1),
    summary: z.string().min(1),
    topics: z.array(z.string().min(1)).default([]),
    operationId: z.string().min(8).optional()
  })
  .strict();
export const raindropSearchInputSchema = z
  .object({ query: z.string(), limit: z.number().int().min(1).max(100).optional() })
  .strict();
export const raindropReferenceInputSchema = z
  .object({
    bookmarkId: z.string().min(1),
    summary: z.string().min(1),
    topics: z.array(z.string().min(1)).default([]),
    operationId: z.string().min(8).optional()
  })
  .strict();

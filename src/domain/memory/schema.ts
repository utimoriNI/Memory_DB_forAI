import { z } from "zod";

export const memoryTypeSchema = z.enum([
  "identity",
  "preference",
  "style",
  "philosophy",
  "knowledge",
  "project",
  "project-state",
  "decision",
  "goal",
  "relationship",
  "session",
  "source"
]);

export const memoryStatusSchema = z.enum([
  "staged",
  "active",
  "reconsidering",
  "deprecated",
  "superseded",
  "archived"
]);

export const importanceSchema = z.enum(["low", "medium", "high"]);
export const dateSchema = z.preprocess(
  (value) =>
    value instanceof Date && !Number.isNaN(value.getTime())
      ? value.toISOString().slice(0, 10)
      : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
);
export const memoryIdSchema = z.string().regex(/^mem_[A-Za-z0-9_-]{8,}$/);

export const memoryFrontmatterObjectSchema = z.object({
  id: memoryIdSchema,
  summary: z.string().trim().min(1).max(500),
  type: memoryTypeSchema,
  topics: z.array(z.string().trim().min(1)).default([]),
  status: memoryStatusSchema,
  pinned: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  importance: importanceSchema.optional(),
  source: z.array(z.string().trim().min(1)).min(1),
  scope: z.array(z.string().trim().min(1)).optional(),
  project: z.string().trim().min(1).nullable().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  lastReviewedAt: dateSchema.nullable().optional(),
  validUntil: dateSchema.nullable().optional(),
  supersedes: z.array(memoryIdSchema).optional(),
  related: z.array(memoryIdSchema).optional()
});

function validateDateOrder(
  value: z.infer<typeof memoryFrontmatterObjectSchema>,
  context: z.RefinementCtx
): void {
  if (value.updatedAt < value.createdAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updatedAt"],
      message: "updatedAt cannot precede createdAt"
    });
  }
  if (value.lastReviewedAt && value.lastReviewedAt < value.createdAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lastReviewedAt"],
      message: "lastReviewedAt cannot precede createdAt"
    });
  }
}

export const memoryFrontmatterSchema = memoryFrontmatterObjectSchema.superRefine(validateDateOrder);
export type MemoryFrontmatter = z.infer<typeof memoryFrontmatterSchema>;

export const philosophyDepthSchema = z.enum([
  "philosophy-principle",
  "implementation-principle",
  "practical-ethics",
  "important-theme",
  "derived-theme"
]);

export const philosophyFrontmatterSchema = memoryFrontmatterObjectSchema
  .extend({
    type: z.literal("philosophy"),
    philosophyDepth: philosophyDepthSchema,
    reviewStatus: z.enum(["pending", "approved", "rejected"]),
    applicableScopes: z.array(z.string().trim().min(1)),
    exceptions: z.array(z.string().trim().min(1)).default([]),
    conflictsWith: z.array(memoryIdSchema).default([]),
    version: z.number().int().positive()
  })
  .superRefine(validateDateOrder)
  .superRefine((value, context) => {
    if (value.status === "active" && value.reviewStatus !== "approved") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewStatus"],
        message: "Active philosophy must be approved"
      });
    }
  });

export type PhilosophyFrontmatter = z.infer<typeof philosophyFrontmatterSchema>;

export function parseMemoryFrontmatter(value: unknown): MemoryFrontmatter {
  const object = z.record(z.string(), z.unknown()).parse(value);
  return object.type === "philosophy"
    ? philosophyFrontmatterSchema.parse(object)
    : memoryFrontmatterSchema.parse(object);
}

export const allowedStatusTransitions: Readonly<
  Record<MemoryFrontmatter["status"], readonly MemoryFrontmatter["status"][]>
> = {
  staged: ["active", "archived"],
  active: ["reconsidering", "deprecated", "superseded", "archived"],
  reconsidering: ["active", "deprecated", "superseded", "archived"],
  deprecated: ["archived"],
  superseded: ["archived"],
  archived: []
};

export function assertStatusTransition(
  from: MemoryFrontmatter["status"],
  to: MemoryFrontmatter["status"]
): void {
  if (from === to) return;
  if (!allowedStatusTransitions[from].includes(to)) {
    throw new Error(`Invalid memory status transition: ${from} -> ${to}`);
  }
}

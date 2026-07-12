import { z } from "zod";
import { memoryFrontmatterObjectSchema } from "../memory/schema.js";

export const proposedActionSchema = z.enum(["create", "update", "merge", "supersede", "archive"]);
export const riskLevelSchema = z.enum(["low", "medium", "high"]);

export const stagingProposalSchema = memoryFrontmatterObjectSchema
  .extend({
    status: z.literal("staged"),
    reviewStatus: z.literal("pending"),
    proposedAction: proposedActionSchema,
    targetPath: z.string().trim().min(1),
    riskLevel: riskLevelSchema,
    operationId: z.string().trim().min(8),
    proposalCreatedAt: z.string().datetime(),
    reason: z.string().trim().min(1).optional()
  })
  .passthrough()
  .superRefine((value, context) => {
    const forcedHighRisk =
      ["identity", "preference", "philosophy", "decision"].includes(value.type) ||
      ["merge", "supersede", "archive"].includes(value.proposedAction);
    if (forcedHighRisk && value.riskLevel !== "high") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["riskLevel"],
        message: "This proposal type/action must be high risk"
      });
    }
  });

export type StagingProposal = z.infer<typeof stagingProposalSchema>;

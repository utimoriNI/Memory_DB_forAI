import { describe, expect, it } from "vitest";
import {
  assertStatusTransition,
  memoryFrontmatterSchema,
  philosophyFrontmatterSchema
} from "../../../src/domain/memory/schema.js";
import { stagingProposalSchema } from "../../../src/domain/staging/schema.js";

const validMemory = {
  id: "mem_01JABCDEFGH",
  summary: "Portable memory",
  type: "knowledge",
  topics: ["memory"],
  status: "active",
  pinned: false,
  confidence: 0.9,
  source: ["session:2026-07-12"],
  createdAt: "2026-07-12",
  updatedAt: "2026-07-12"
} as const;

describe("memory frontmatter", () => {
  it("accepts valid common metadata", () => {
    expect(memoryFrontmatterSchema.parse(validMemory).id).toBe(validMemory.id);
  });

  it("rejects missing sources, invalid confidence, and reversed dates", () => {
    expect(() => memoryFrontmatterSchema.parse({ ...validMemory, source: [] })).toThrow();
    expect(() => memoryFrontmatterSchema.parse({ ...validMemory, confidence: 1.1 })).toThrow();
    expect(() =>
      memoryFrontmatterSchema.parse({
        ...validMemory,
        updatedAt: "2026-07-11",
        createdAt: "2026-07-12"
      })
    ).toThrow();
  });

  it("normalizes YAML timestamp values to canonical date strings", () => {
    const parsed = memoryFrontmatterSchema.parse({
      ...validMemory,
      createdAt: new Date("2026-07-12T00:00:00.000Z"),
      updatedAt: new Date("2026-07-13T00:00:00.000Z")
    });

    expect(parsed.createdAt).toBe("2026-07-12");
    expect(parsed.updatedAt).toBe("2026-07-13");
  });

  it("requires approval before philosophy becomes active", () => {
    expect(() =>
      philosophyFrontmatterSchema.parse({
        ...validMemory,
        type: "philosophy",
        reviewStatus: "pending",
        philosophyDepth: "philosophy-principle",
        applicableScopes: ["development"],
        version: 1
      })
    ).toThrow(/approved/);
  });

  it("enforces allowed status transitions", () => {
    expect(() => assertStatusTransition("active", "reconsidering")).not.toThrow();
    expect(() => assertStatusTransition("archived", "active")).toThrow();
  });

  it("forces sensitive proposals to high risk", () => {
    expect(() =>
      stagingProposalSchema.parse({
        ...validMemory,
        type: "preference",
        status: "staged",
        reviewStatus: "pending",
        proposedAction: "update",
        targetPath: "profile/preferences.md",
        riskLevel: "low",
        operationId: "operation-1",
        proposalCreatedAt: "2026-07-12T00:00:00.000Z"
      })
    ).toThrow(/high risk/);
  });
});

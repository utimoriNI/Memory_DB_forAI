import { describe, expect, it } from "vitest";
import {
  archiveInputSchema,
  buildContextInputSchema,
  memorySearchInputSchema,
  stagingApproveInputSchema
} from "../../../src/mcp/schemas/tools.js";

describe("MCP input schemas", () => {
  it("validates search filters and limits", () => {
    expect(
      memorySearchInputSchema.parse({ query: "memory", types: ["knowledge"], limit: 10 })
    ).toMatchObject({ limit: 10 });
    expect(() => memorySearchInputSchema.parse({ query: "x", types: ["invalid"] })).toThrow();
    expect(() => memorySearchInputSchema.parse({ query: "x", limit: 101 })).toThrow();
  });

  it("validates context purposes and budgets", () => {
    expect(buildContextInputSchema.parse({ purpose: "planning" }).purpose).toBe("planning");
    expect(() => buildContextInputSchema.parse({ purpose: "unknown" })).toThrow();
  });

  it("requires explicit archive approval and safe staging paths", () => {
    expect(() => archiveInputSchema.parse({ path: "knowledge/a.md", approved: false })).toThrow();
    expect(() => stagingApproveInputSchema.parse({ proposalPath: "knowledge/a.md" })).toThrow();
  });
});

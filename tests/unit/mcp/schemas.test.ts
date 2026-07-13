import { describe, expect, it } from "vitest";
import {
  archiveInputSchema,
  buildContextInputSchema,
  journalImportInputSchema,
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

  it("validates Journal import payloads", () => {
    expect(
      journalImportInputSchema.parse({
        entryId: "journal-2026-07-13-001",
        version: 1,
        recordedAt: "2026-07-13T08:30:00+09:00",
        journalPath: "entries/2026-07-13.md",
        summary: "A journal summary"
      })
    ).toMatchObject({ version: 1, topics: [] });
    expect(() =>
      journalImportInputSchema.parse({
        entryId: "../escape",
        version: 1,
        recordedAt: "2026-07-13T08:30:00+09:00",
        journalPath: "entries/2026-07-13.md",
        summary: "A journal summary"
      })
    ).toThrow();
    expect(() =>
      journalImportInputSchema.parse({
        entryId: "journal-1",
        version: 1,
        recordedAt: "2026-07-13T08:30:00+09:00",
        journalPath: "../outside.md",
        summary: "A journal summary"
      })
    ).toThrow();
  });
});

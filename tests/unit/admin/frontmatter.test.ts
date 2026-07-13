import { describe, expect, it } from "vitest";
import {
  normalizeVaultMarkdownPath,
  parseMarkdownFrontmatter,
  serializeMarkdownFrontmatter
} from "../../../src/admin/shared/frontmatter.js";

describe("mobile admin frontmatter", () => {
  it("round-trips YAML frontmatter with Japanese text", () => {
    const raw = serializeMarkdownFrontmatter(
      { id: "mem_12345678", summary: "承認候補", source: ["chat:2026-07-13"] },
      "本文"
    );
    expect(parseMarkdownFrontmatter(raw)).toEqual({
      attributes: { id: "mem_12345678", summary: "承認候補", source: ["chat:2026-07-13"] },
      body: "本文"
    });
  });

  it("rejects traversal and non-Markdown paths", () => {
    expect(() => normalizeVaultMarkdownPath("../profile/identity.md")).toThrow("Invalid Vault");
    expect(() => normalizeVaultMarkdownPath("/profile/identity.md")).toThrow("Invalid Vault");
    expect(() => normalizeVaultMarkdownPath("profile/identity.txt")).toThrow("Invalid Vault");
    expect(normalizeVaultMarkdownPath("projects/demo/STATE.md")).toBe("projects/demo/STATE.md");
  });
});

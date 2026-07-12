import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { VaultFileSystem } from "../../../src/infrastructure/filesystem/vault-filesystem.js";
import { MarkdownRepository } from "../../../src/infrastructure/markdown/markdown-repository.js";

describe("MarkdownRepository", () => {
  let repository: MarkdownRepository;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "markdown-repository-"));
    const fileSystem = new VaultFileSystem(root);
    await fileSystem.initialize();
    repository = new MarkdownRepository(fileSystem);
  });

  it("round-trips validated memory and finds it by ID", async () => {
    const metadata = {
      id: "mem_01JABCDEFGH",
      summary: "A reusable fact",
      type: "knowledge",
      topics: ["testing"],
      status: "active",
      pinned: false,
      source: ["test:fixture"],
      createdAt: "2026-07-12",
      updatedAt: "2026-07-12"
    };
    await repository.writeMemory("knowledge/fact.md", metadata, "# Fact\n\nBody", {
      createOnly: true
    });
    const document = await repository.readMemory("knowledge/fact.md");
    expect(document.frontmatter).toEqual(metadata);
    expect(document.body).toContain("Body");
    expect((await repository.findById(metadata.id))?.path).toBe("knowledge/fact.md");
  });

  it("refuses invalid formal Frontmatter", async () => {
    await expect(repository.writeMemory("knowledge/bad.md", {}, "bad")).rejects.toThrow();
  });
});

import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ContextBuilder } from "../../../src/application/use-cases/build-context.js";
import { IndexRepository } from "../../../src/infrastructure/index/index-repository.js";
import { MarkdownSearchProvider } from "../../../src/infrastructure/index/markdown-search-provider.js";
import { VaultFileSystem } from "../../../src/infrastructure/filesystem/vault-filesystem.js";
import { MarkdownRepository } from "../../../src/infrastructure/markdown/markdown-repository.js";

describe("index, search, and context", () => {
  let markdown: MarkdownRepository;
  let indexRepository: IndexRepository;
  let search: MarkdownSearchProvider;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "search-context-"));
    const fileSystem = new VaultFileSystem(root);
    await fileSystem.initialize();
    markdown = new MarkdownRepository(fileSystem);
    indexRepository = new IndexRepository(markdown);
    search = new MarkdownSearchProvider(indexRepository, markdown);
    await markdown.writeSystemDocument("MEMORY.md", "# Memory index");
    await addMemory(
      "knowledge/local-first.md",
      {
        id: "mem_01JLOCALFIRST",
        summary: "Prefer portable local-first storage",
        type: "knowledge",
        topics: ["storage", "portability"],
        status: "active",
        pinned: true,
        project: "vault",
        updatedAt: "2026-07-12"
      },
      "Markdown is inspectable and portable."
    );
    await addMemory(
      "knowledge/old.md",
      {
        id: "mem_01JOLDENTRY",
        summary: "Old approach",
        type: "knowledge",
        topics: ["storage"],
        status: "deprecated",
        pinned: false,
        updatedAt: "2025-01-01"
      },
      "Legacy body."
    );
    await addMemory(
      "_staging/candidate.md",
      {
        id: "mem_01JSTAGING",
        summary: "Pending candidate",
        type: "knowledge",
        topics: ["storage"],
        status: "staged",
        pinned: false,
        updatedAt: "2026-07-12"
      },
      "Unapproved."
    );
    await indexRepository.rebuild(new Date("2026-07-12T00:00:00Z"));
  });

  async function addMemory(
    file: string,
    partial: Record<string, unknown>,
    body: string
  ): Promise<void> {
    await markdown.writeMemory(
      file,
      {
        source: ["test:fixture"],
        createdAt: "2025-01-01",
        ...partial
      },
      body
    );
  }

  it("rebuilds a reproducible index and applies default exclusions", async () => {
    expect((await indexRepository.read()).entries).toHaveLength(3);
    const results = await search.search({ query: "storage" });
    expect(results.map((result) => result.entry.id)).toEqual(["mem_01JLOCALFIRST"]);
  });

  it("searches summary, topics, body, filters, and optional staging", async () => {
    expect((await search.search({ query: "portable" }))[0]?.matchedIn).toContain("summary");
    expect((await search.search({ query: "portability" }))[0]?.matchedIn).toContain("topics");
    expect((await search.search({ query: "inspectable" }))[0]?.matchedIn).toContain("body");
    expect(await search.search({ query: "", project: "other" })).toHaveLength(0);
    expect(
      (await search.search({ query: "pending", includeStaging: true })).map(
        (result) => result.entry.id
      )
    ).toContain("mem_01JSTAGING");
  });

  it("builds bounded context with selection reasons", async () => {
    const builder = new ContextBuilder(markdown, search);
    const context = await builder.build({
      purpose: "general",
      query: "portable",
      maxCharacters: 10_000
    });
    expect(context.files.map((file) => file.path)).toEqual([
      "MEMORY.md",
      "knowledge/local-first.md"
    ]);
    expect(context.files.every((file) => file.reason.length > 0)).toBe(true);
    const constrained = await builder.build({
      purpose: "general",
      query: "portable",
      maxCharacters: 5
    });
    expect(constrained.truncated).toBe(true);
    expect(constrained.files).toHaveLength(0);
  });
});

import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { JournalImportService } from "../../../src/application/use-cases/journal-import.js";
import { MemoryLifecycleService } from "../../../src/application/use-cases/memory-lifecycle.js";
import { VaultFileSystem } from "../../../src/infrastructure/filesystem/vault-filesystem.js";
import { IndexRepository } from "../../../src/infrastructure/index/index-repository.js";
import { MarkdownRepository } from "../../../src/infrastructure/markdown/markdown-repository.js";

describe("JournalImportService", () => {
  let importer: JournalImportService;
  let markdown: MarkdownRepository;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "journal-import-"));
    const fileSystem = new VaultFileSystem(root);
    await fileSystem.initialize();
    markdown = new MarkdownRepository(fileSystem);
    const index = new IndexRepository(markdown);
    await index.rebuild(new Date("2026-07-13T00:00:00.000Z"));
    importer = new JournalImportService(new MemoryLifecycleService(markdown, index));
  });

  const entry = {
    entryId: "journal-2026-07-13-001",
    version: 1,
    recordedAt: "2026-07-13T08:30:00+09:00",
    journalPath: "entries/2026-07-13.md",
    summary: "MemoryDBへの取り込み方を検討した",
    transcript: "長期記憶と日記を分離したい。",
    topics: ["memory", "workflow"],
    project: "ai-memory-db"
  };

  it("imports Journal content into _inbox with provenance", async () => {
    const result = await importer.importEntry(entry);
    expect(result.path).toMatch(/^_inbox\/2026-07-13-/);
    const document = await markdown.read(result.path);
    expect(document.frontmatter.source).toEqual(["journal:entry:journal-2026-07-13-001:v1"]);
    expect(document.frontmatter.status).toBe("inbox");
    expect(document.body).toContain("Journal path: `entries/2026-07-13.md`");
    expect(document.body).toContain("MemoryDBへの取り込み方を検討した");
  });

  it("is idempotent for the same Journal version and content", async () => {
    const first = await importer.importEntry(entry);
    const second = await importer.importEntry(entry);
    expect(second).toEqual(first);
    expect(
      (await markdown.listMarkdown({ includeStaging: true })).filter((file) =>
        file.startsWith("_inbox/")
      )
    ).toHaveLength(1);
  });

  it("rejects a forged content hash", async () => {
    await expect(
      importer.importEntry({ ...entry, contentHash: `sha256:${"0".repeat(64)}` })
    ).rejects.toThrow(/contentHash/);
  });
});

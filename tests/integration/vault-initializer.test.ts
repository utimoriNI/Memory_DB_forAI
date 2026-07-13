import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VaultInitializer } from "../../src/application/use-cases/initialize-vault.js";
import { JournalImportService } from "../../src/application/use-cases/journal-import.js";
import { MemoryLifecycleService } from "../../src/application/use-cases/memory-lifecycle.js";
import { validateVault } from "../../src/application/use-cases/validate-vault.js";
import { VaultFileSystem } from "../../src/infrastructure/filesystem/vault-filesystem.js";
import { IndexRepository } from "../../src/infrastructure/index/index-repository.js";
import { MarkdownRepository } from "../../src/infrastructure/markdown/markdown-repository.js";

describe("VaultInitializer", () => {
  it("creates the required structure idempotently and a valid index", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "initialized-vault-"));
    const fileSystem = new VaultFileSystem(root);
    const markdown = new MarkdownRepository(fileSystem);
    const index = new IndexRepository(markdown);
    const initializer = new VaultInitializer(markdown, index);
    const now = new Date("2026-07-12T02:00:00.000Z");
    await initializer.initialize(now);
    await initializer.initialize(now);

    expect(await fileSystem.exists("MEMORY.md")).toBe(true);
    expect(await fileSystem.exists("projects/example-project/STATE.md")).toBe(true);
    expect((await index.read()).entries).toHaveLength(5);
    expect(await validateVault(markdown)).toMatchObject({ valid: true, checkedMemories: 5 });
  });

  it("does not validate unclassified Inbox source material as formal memory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "initialized-vault-"));
    const fileSystem = new VaultFileSystem(root);
    const markdown = new MarkdownRepository(fileSystem);
    const index = new IndexRepository(markdown);
    await new VaultInitializer(markdown, index).initialize(new Date("2026-07-12T02:00:00.000Z"));
    const importer = new JournalImportService(new MemoryLifecycleService(markdown, index));

    await importer.importEntry({
      entryId: "journal-2026-07-12-001",
      version: 1,
      recordedAt: "2026-07-12T08:30:00+09:00",
      journalPath: "entries/2026-07-12.md",
      summary: "未分類の日誌素材"
    });

    expect(await validateVault(markdown)).toMatchObject({ valid: true, checkedMemories: 5 });
  });
});

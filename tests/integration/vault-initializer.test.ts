import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VaultInitializer } from "../../src/application/use-cases/initialize-vault.js";
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
});

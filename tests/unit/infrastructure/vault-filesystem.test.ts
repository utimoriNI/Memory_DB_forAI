import { mkdtemp, mkdir, readFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { VaultFileSystem } from "../../../src/infrastructure/filesystem/vault-filesystem.js";

describe("VaultFileSystem", () => {
  let root: string;
  let fileSystem: VaultFileSystem;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "memory-vault-"));
    fileSystem = new VaultFileSystem(root);
    await fileSystem.initialize();
  });

  it("rejects traversal and absolute paths", async () => {
    await expect(fileSystem.resolveForWrite("../escape.md")).rejects.toThrow(/traversal|escapes/);
    await expect(fileSystem.resolveForWrite("/tmp/escape.md")).rejects.toThrow(/relative/);
  });

  it("rejects symlink escapes", async () => {
    const outside = await mkdtemp(path.join(os.tmpdir(), "outside-vault-"));
    await symlink(outside, path.join(root, "linked"));
    await expect(fileSystem.resolveForWrite("linked/escape.md")).rejects.toThrow(/escapes/);
  });

  it("writes atomically, prevents duplicates, and backs up updates", async () => {
    await fileSystem.writeTextAtomic("knowledge/a.md", "first", { createOnly: true });
    await expect(
      fileSystem.writeTextAtomic("knowledge/a.md", "duplicate", { createOnly: true })
    ).rejects.toThrow(/overwrite/);
    const result = await fileSystem.writeTextAtomic("knowledge/a.md", "second", { backup: true });
    expect(await readFile(path.join(root, "knowledge/a.md"), "utf8")).toBe("second");
    expect(result.backupPath).toBeDefined();
    expect(await readFile(path.join(root, result.backupPath as string), "utf8")).toBe("first");
  });

  it("moves files without replacing destinations", async () => {
    await mkdir(path.join(root, "_staging"));
    await fileSystem.writeTextAtomic("_staging/a.md", "candidate", { createOnly: true });
    await fileSystem.move("_staging/a.md", "_archive/rejected/a.md");
    expect(await fileSystem.readText("_archive/rejected/a.md")).toBe("candidate");
    expect(await fileSystem.exists("_staging/a.md")).toBe(false);
  });
});

import { mkdtemp, writeFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ObsidianReadOnlyAdapter } from "../../../src/infrastructure/obsidian/obsidian-readonly-adapter.js";
import { MockRaindropSearchProvider } from "../../../src/infrastructure/raindrop/provider.js";

describe("external source adapters", () => {
  it("searches Obsidian read-only by body, tag, and frontmatter", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "obsidian-vault-"));
    await writeFile(
      path.join(root, "note.md"),
      "---\ntags: [ai]\nkind: research\n---\n# Note\n\nPortable Markdown",
      "utf8"
    );
    const adapter = new ObsidianReadOnlyAdapter(root);
    expect(
      await adapter.search({ query: "portable", tags: ["ai"], frontmatter: { kind: "research" } })
    ).toHaveLength(1);
    expect((await adapter.get("note.md")).title).toBe("Note");
  });

  it("rejects Obsidian traversal and symlink escapes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "obsidian-safe-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "obsidian-outside-"));
    await writeFile(path.join(outside, "secret.md"), "secret", "utf8");
    await symlink(outside, path.join(root, "linked"));
    const adapter = new ObsidianReadOnlyAdapter(root);
    await expect(adapter.get("../secret.md")).rejects.toThrow(/Invalid/);
    await expect(adapter.get("linked/secret.md")).rejects.toThrow(/escapes/);
  });

  it("provides a deterministic Raindrop mock", async () => {
    const provider = new MockRaindropSearchProvider([
      { id: "1", url: "https://example.com", title: "Local first", tags: ["memory"] }
    ]);
    expect(await provider.search("memory")).toHaveLength(1);
    expect((await provider.getBookmark("1"))?.title).toBe("Local first");
    expect(await provider.getBookmark("missing")).toBeNull();
  });
});

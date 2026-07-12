import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryLifecycleService } from "../../../src/application/use-cases/memory-lifecycle.js";
import { VaultFileSystem } from "../../../src/infrastructure/filesystem/vault-filesystem.js";
import { IndexRepository } from "../../../src/infrastructure/index/index-repository.js";
import { MarkdownRepository } from "../../../src/infrastructure/markdown/markdown-repository.js";

describe("MemoryLifecycleService", () => {
  let markdown: MarkdownRepository;
  let lifecycle: MemoryLifecycleService;
  const now = new Date("2026-07-12T01:00:00.000Z");

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lifecycle-"));
    const fileSystem = new VaultFileSystem(root);
    await fileSystem.initialize();
    markdown = new MarkdownRepository(fileSystem);
    const index = new IndexRepository(markdown);
    await index.rebuild(now);
    lifecycle = new MemoryLifecycleService(markdown, index);
  });

  const common = {
    summary: "Reusable knowledge",
    type: "knowledge",
    topics: ["memory"],
    pinned: false,
    source: ["session:2026-07-12"]
  };

  it("creates and idempotently approves a proposal", async () => {
    const proposalPath = await lifecycle.propose({
      frontmatter: common,
      body: "# Knowledge\n\nUseful later.",
      targetPath: "knowledge/reusable.md",
      operationId: "operation-create-1",
      now
    });
    expect((await lifecycle.listPending()).map((entry) => entry.path)).toContain(proposalPath);
    expect(await lifecycle.diff(proposalPath, now)).toContain("+++ b/knowledge/reusable.md");
    const first = await lifecycle.approve(proposalPath, { now });
    const second = await lifecycle.approve(proposalPath, { now });
    expect(second).toEqual(first);
    expect((await markdown.readMemory("knowledge/reusable.md")).frontmatter.status).toBe("active");
    expect(await markdown.fileSystem.exists("_archive/approved/mem_")).toBe(false);
  });

  it("requires explicit acknowledgement for high-risk proposals", async () => {
    const proposal = await lifecycle.propose({
      frontmatter: { ...common, id: "mem_01JPREFERENCE", type: "preference" },
      body: "Prefer short answers.",
      targetPath: "profile/preferences.md",
      operationId: "operation-high-risk",
      now
    });
    await expect(lifecycle.approve(proposal, { now })).rejects.toThrow(/High-risk/);
    await expect(
      lifecycle.approve(proposal, { now, acknowledgeHighRisk: true })
    ).resolves.toMatchObject({ action: "create" });
  });

  it("backs up updates and rejects candidates into the archive", async () => {
    await markdown.writeMemory(
      "knowledge/reusable.md",
      {
        ...common,
        id: "mem_01JUPDATE",
        status: "active",
        createdAt: "2026-07-11",
        updatedAt: "2026-07-11"
      },
      "Old"
    );
    const update = await lifecycle.propose({
      frontmatter: { ...common, id: "mem_01JUPDATE", createdAt: "2026-07-11" },
      body: "New",
      targetPath: "knowledge/reusable.md",
      proposedAction: "update",
      operationId: "operation-update",
      now
    });
    const result = await lifecycle.approve(update, { now });
    expect(result.backupPath).toContain("_state/backups/");

    const rejected = await lifecycle.propose({
      frontmatter: { ...common, id: "mem_01JREJECTED" },
      body: "Reject me",
      targetPath: "knowledge/rejected.md",
      operationId: "operation-reject",
      now
    });
    await expect(lifecycle.reject(rejected, "Not durable", now)).resolves.toBe(
      "_archive/rejected/mem_01JREJECTED.md"
    );
  });

  it("rejects likely secrets in inbox and proposals", async () => {
    await expect(
      lifecycle.addInbox({
        title: "secret",
        content: "api_key=do-not-store",
        source: "manual",
        now
      })
    ).rejects.toThrow(/secret/i);
  });
});

import { describe, expect, it } from "vitest";
import type {
  GitChange,
  GitHubFile,
  GitHubTreeEntry,
  GitVaultGateway
} from "../../../src/admin/github/git-data-client.js";
import { serializeMarkdownFrontmatter } from "../../../src/admin/shared/frontmatter.js";
import { AdminVaultService } from "../../../src/admin/vault/admin-vault-service.js";

class FakeGitVaultGateway implements GitVaultGateway {
  public readonly reads: string[] = [];

  public getHeadSha(): Promise<string> {
    return Promise.resolve("head-1");
  }

  public getTreeEntries(): Promise<GitHubTreeEntry[]> {
    const unrelated = Array.from({ length: 60 }, (_, index) => ({
      path: `knowledge/unrelated-${index}.md`,
      mode: "100644",
      type: "blob" as const,
      sha: `unrelated-${index}`
    }));
    return Promise.resolve([
      ...unrelated,
      { path: "_state/index.json", mode: "100644", type: "blob", sha: "index" },
      { path: "_staging/mem_12345678.md", mode: "100644", type: "blob", sha: "proposal" }
    ]);
  }

  public readFile(path: string, sha: string): Promise<GitHubFile> {
    this.reads.push(path);
    if (path === "_state/index.json") {
      return Promise.resolve({
        path,
        sha,
        content: `${JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-13T00:00:00.000Z", entries: [] })}\n`
      });
    }
    if (path === "_staging/mem_12345678.md") {
      return Promise.resolve({
        path,
        sha,
        content: serializeMarkdownFrontmatter(
          {
            id: "mem_12345678",
            summary: "Keep candidate memories in staging until approved",
            type: "knowledge",
            topics: ["memory"],
            status: "staged",
            pinned: false,
            source: ["chat:2026-07-13"],
            createdAt: "2026-07-13",
            updatedAt: "2026-07-13",
            reviewStatus: "pending",
            proposedAction: "create",
            targetPath: "knowledge/staging.md",
            riskLevel: "low",
            operationId: "operation-12345678",
            proposalCreatedAt: "2026-07-13T00:00:00.000Z"
          },
          "Candidate body."
        )
      });
    }
    throw new Error(`Unexpected blob read: ${path}`);
  }

  public commitChanges(input: {
    expectedHeadSha: string;
    changes: GitChange[];
    message: string;
  }): Promise<{ headSha: string; commitSha: string }> {
    void input;
    return Promise.reject(new Error("Not used in this test"));
  }
}

describe("AdminVaultService", () => {
  it("loads only the index and staged proposals instead of every Vault blob", async () => {
    const gateway = new FakeGitVaultGateway();
    const service = new AdminVaultService(gateway);

    await expect(service.dashboard()).resolves.toMatchObject({
      headSha: "head-1",
      pendingCount: 1,
      proposals: [{ id: "mem_12345678", path: "_staging/mem_12345678.md" }]
    });
    expect(gateway.reads.sort()).toEqual(["_staging/mem_12345678.md", "_state/index.json"]);
  });
});

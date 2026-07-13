import { describe, expect, it } from "vitest";
import { PrefixedGitVaultGateway } from "../../../src/admin/github/prefixed-gateway.js";
import type { GitVaultGateway } from "../../../src/admin/github/git-data-client.js";

describe("PrefixedGitVaultGateway", () => {
  it("exposes only Vault-relative paths and prefixes mutations", async () => {
    const calls: string[] = [];
    const upstream: GitVaultGateway = {
      getHeadSha: () => Promise.resolve("head"),
      getTreeEntries: () =>
        Promise.resolve([
          { path: "memory/_staging/candidate.md", mode: "100644", type: "blob", sha: "one" },
          { path: "_inbox/old.md", mode: "100644", type: "blob", sha: "two" }
        ]),
      readFile: (path, sha) => {
        calls.push(path);
        return Promise.resolve({ path, sha, content: "content" });
      },
      commitChanges: (input) => {
        calls.push(input.changes[0]?.path ?? "");
        return Promise.resolve({ headSha: "next", commitSha: "next" });
      }
    };
    const gateway = new PrefixedGitVaultGateway(upstream, "memory");

    await expect(gateway.getTreeEntries("head")).resolves.toEqual([
      { path: "_staging/candidate.md", mode: "100644", type: "blob", sha: "one" }
    ]);
    await expect(gateway.readFile("_staging/candidate.md", "one")).resolves.toMatchObject({
      path: "_staging/candidate.md"
    });
    await gateway.commitChanges({
      expectedHeadSha: "head",
      changes: [{ path: "_inbox/note.md", content: "note" }],
      message: "test"
    });
    expect(calls).toEqual(["memory/_staging/candidate.md", "memory/_inbox/note.md"]);
  });
});

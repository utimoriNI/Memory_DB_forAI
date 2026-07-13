import { describe, expect, it } from "vitest";
import { GitHubGitDataClient } from "../../../src/admin/github/git-data-client.js";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("GitHubGitDataClient", () => {
  it("creates one tree, commit, and ref update after checking the expected head", async () => {
    const calls: Array<{ url: string; init?: RequestInit | undefined }> = [];
    const responses = [
      jsonResponse({ object: { sha: "head-1" } }),
      jsonResponse({ tree: { sha: "tree-1" } }),
      jsonResponse({ sha: "tree-2" }),
      jsonResponse({ sha: "commit-2" }),
      jsonResponse({ ref: "refs/heads/main", object: { sha: "commit-2" } })
    ];
    const fetchMock: typeof fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
      calls.push({ url, init });
      const response = responses.shift();
      if (!response) throw new Error("Unexpected request");
      return Promise.resolve(response);
    };
    const client = new GitHubGitDataClient({
      owner: "owner",
      repository: "vault",
      branch: "main",
      token: "not-a-real-token",
      fetch: fetchMock
    });

    await expect(
      client.commitChanges({
        expectedHeadSha: "head-1",
        changes: [{ path: "_inbox/test.md", content: "hello\n" }],
        message: "memory: inbox"
      })
    ).resolves.toEqual({ headSha: "commit-2", commitSha: "commit-2" });

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/repos/owner/vault/git/ref/heads/main",
      "/repos/owner/vault/git/commits/head-1",
      "/repos/owner/vault/git/trees",
      "/repos/owner/vault/git/commits",
      "/repos/owner/vault/git/refs/heads/main"
    ]);
    const treeRequestBody = calls[2]?.init?.body;
    if (typeof treeRequestBody !== "string") throw new Error("Expected a JSON tree request body");
    expect(JSON.parse(treeRequestBody)).toMatchObject({
      base_tree: "tree-1",
      tree: [{ path: "_inbox/test.md", content: "hello\n" }]
    });
  });

  it("does not create a commit when the displayed head is stale", async () => {
    const fetchMock: typeof fetch = () =>
      Promise.resolve(jsonResponse({ object: { sha: "new-head" } }));
    const client = new GitHubGitDataClient({
      owner: "owner",
      repository: "vault",
      branch: "main",
      token: "not-a-real-token",
      fetch: fetchMock
    });
    await expect(
      client.commitChanges({ expectedHeadSha: "old-head", changes: [], message: "memory: no" })
    ).rejects.toThrow("Vault changed since this screen was loaded");
  });
});

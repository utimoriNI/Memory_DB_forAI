import { describe, expect, it } from "vitest";
import { GitHubApiError } from "../../../src/admin/github/git-data-client.js";
import { errorResponse, tokenFingerprint } from "../../../src/admin/worker.js";

describe("mobile admin Worker error responses", () => {
  it("distinguishes GitHub authentication failures without returning provider details", async () => {
    const response = errorResponse(new GitHubApiError("sensitive upstream text", 401), {
      tokenFingerprint: "test-fingerprint"
    });
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "GITHUB_AUTHENTICATION_FAILED",
        message: "GitHub rejected the Vault token. Replace GITHUB_TOKEN with a valid token.",
        diagnostic: { workerTokenFingerprint: "test-fingerprint" }
      }
    });
    expect(response.status).toBe(502);
  });

  it("identifies missing repository access", async () => {
    const response = errorResponse(new GitHubApiError("not found", 404));
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "GITHUB_REPOSITORY_UNAVAILABLE",
        message:
          "GitHub could not access the configured Vault repository or branch. Check GITHUB_OWNER, GITHUB_REPOSITORY, GITHUB_BRANCH, and token repository access."
      }
    });
    expect(response.status).toBe(404);
  });

  it("creates a stable, non-reversible short fingerprint for comparison", async () => {
    await expect(tokenFingerprint("github_pat_example")).resolves.toHaveLength(12);
    await expect(tokenFingerprint(undefined)).resolves.toBeNull();
  });
});

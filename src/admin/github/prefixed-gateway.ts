import type { GitChange, GitHubFile, GitHubTreeEntry, GitVaultGateway } from "./git-data-client.js";

function normalizePrefix(prefix: string): string {
  const normalized = prefix.replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.split("/").some((part) => part === "." || part === "..")) {
    throw new Error("Invalid Vault repository path");
  }
  return normalized;
}

/** Maps Vault-relative paths to a dedicated directory in a Git repository. */
export class PrefixedGitVaultGateway implements GitVaultGateway {
  readonly #prefix: string;

  public constructor(
    private readonly upstream: GitVaultGateway,
    prefix: string
  ) {
    this.#prefix = normalizePrefix(prefix);
  }

  public getHeadSha(): Promise<string> {
    return this.upstream.getHeadSha();
  }

  public async getTreeEntries(headSha: string): Promise<GitHubTreeEntry[]> {
    const prefix = `${this.#prefix}/`;
    return (await this.upstream.getTreeEntries(headSha))
      .filter((entry) => entry.path.startsWith(prefix))
      .map((entry) => ({ ...entry, path: entry.path.slice(prefix.length) }));
  }

  public async readFile(path: string, sha: string): Promise<GitHubFile> {
    const file = await this.upstream.readFile(`${this.#prefix}/${path}`, sha);
    return { ...file, path };
  }

  public commitChanges(input: {
    expectedHeadSha: string;
    changes: GitChange[];
    message: string;
  }): Promise<{ headSha: string; commitSha: string }> {
    return this.upstream.commitChanges({
      ...input,
      changes: input.changes.map((change) => ({
        ...change,
        path: `${this.#prefix}/${change.path}`
      }))
    });
  }
}

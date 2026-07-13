export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
}

export interface GitHubFile {
  path: string;
  sha: string;
  content: string;
}

export interface GitChange {
  path: string;
  content: string | null;
}

/** Minimal Git object API surface consumed by the admin lifecycle service. */
export interface GitVaultGateway {
  getHeadSha(): Promise<string>;
  getTreeEntries(headSha: string): Promise<GitHubTreeEntry[]>;
  readFile(path: string, sha: string): Promise<GitHubFile>;
  commitChanges(input: {
    expectedHeadSha: string;
    changes: GitChange[];
    message: string;
  }): Promise<{ headSha: string; commitSha: string }>;
}

interface GitRefResponse {
  object: { sha: string };
}

interface GitCommitResponse {
  tree: { sha: string };
}

interface GitTreeResponse {
  tree: GitHubTreeEntry[];
}

interface GitBlobResponse {
  content: string;
  encoding: string;
}

interface CreatedTreeResponse {
  sha: string;
}

interface CreatedCommitResponse {
  sha: string;
}

export class GitHubApiError extends Error {
  public constructor(
    message: string,
    readonly status: number,
    readonly retryable = false
  ) {
    super(message);
  }
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value.replaceAll(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHubGitDataClient implements GitVaultGateway {
  readonly #baseUrl: string;

  public constructor(
    private readonly options: {
      owner: string;
      repository: string;
      branch: string;
      token: string;
      fetch?: typeof fetch;
    }
  ) {
    this.#baseUrl = `https://api.github.com/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repository)}`;
  }

  public async getHeadSha(): Promise<string> {
    const result = await this.#request<GitRefResponse>(
      `/git/ref/heads/${encodeURIComponent(this.options.branch)}`
    );
    return result.object.sha;
  }

  public async getTreeEntries(headSha: string): Promise<GitHubTreeEntry[]> {
    const commit = await this.#request<GitCommitResponse>(`/git/commits/${headSha}`);
    const tree = await this.#request<GitTreeResponse>(`/git/trees/${commit.tree.sha}?recursive=1`);
    return tree.tree.filter((entry) => entry.type === "blob");
  }

  public async readFile(path: string, sha: string): Promise<GitHubFile> {
    const blob = await this.#request<GitBlobResponse>(`/git/blobs/${sha}`);
    if (blob.encoding !== "base64")
      throw new Error(`Unsupported GitHub blob encoding: ${blob.encoding}`);
    return { path, sha, content: decodeBase64Utf8(blob.content) };
  }

  public async readFiles(headSha: string): Promise<GitHubFile[]> {
    const tree = await this.getTreeEntries(headSha);
    return Promise.all(tree.map((entry) => this.readFile(entry.path, entry.sha)));
  }

  /** Creates one Git commit containing all changes. It rejects a stale client view. */
  public async commitChanges(input: {
    expectedHeadSha: string;
    changes: GitChange[];
    message: string;
  }): Promise<{ headSha: string; commitSha: string }> {
    const actualHeadSha = await this.getHeadSha();
    if (actualHeadSha !== input.expectedHeadSha) {
      throw new GitHubApiError(
        "Vault changed since this screen was loaded. Refresh and review again.",
        409
      );
    }
    const commit = await this.#request<GitCommitResponse>(`/git/commits/${actualHeadSha}`);
    const tree = await this.#request<CreatedTreeResponse>("/git/trees", {
      method: "POST",
      body: {
        base_tree: commit.tree.sha,
        tree: input.changes.map((change) =>
          change.content === null
            ? { path: change.path, mode: "100644", type: "blob", sha: null }
            : { path: change.path, mode: "100644", type: "blob", content: change.content }
        )
      }
    });
    const createdCommit = await this.#request<CreatedCommitResponse>("/git/commits", {
      method: "POST",
      body: { message: input.message, tree: tree.sha, parents: [actualHeadSha] }
    });
    await this.#request(`/git/refs/heads/${encodeURIComponent(this.options.branch)}`, {
      method: "PATCH",
      body: { sha: createdCommit.sha, force: false }
    });
    return { headSha: createdCommit.sha, commitSha: createdCommit.sha };
  }

  async #request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await (this.options.fetch ?? fetch)(`${this.#baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.options.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ai-memory-admin/0.1"
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) })
    });
    if (!response.ok) {
      const message = (await response.text()).slice(0, 500) || response.statusText;
      throw new GitHubApiError(
        `GitHub API request failed (${response.status}): ${message}`,
        response.status,
        response.status >= 500
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

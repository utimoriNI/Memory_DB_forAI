import { parseMemoryFrontmatter, type MemoryFrontmatter } from "../../domain/memory/schema.js";
import type { MemoryIndexEntry } from "../../domain/search/types.js";
import { stagingProposalSchema, type StagingProposal } from "../../domain/staging/schema.js";
import { createWholeFileDiff } from "../shared/diff.js";
import {
  normalizeVaultMarkdownPath,
  parseMarkdownFrontmatter,
  proposalIdFromPath,
  serializeMarkdownFrontmatter
} from "../shared/frontmatter.js";
import type { GitChange, GitVaultGateway } from "../github/git-data-client.js";

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|access[_-]?token|password)\s*[:=]\s*\S+/i,
  /\bsk-[A-Za-z0-9_-]{20,}\b/
];

const STAGING_PREFIX = "_staging/";

export interface ProposalSummary {
  id: string;
  path: string;
  summary: string;
  type: string;
  targetPath: string;
  proposedAction: string;
  riskLevel: string;
  proposalCreatedAt: string;
}

export interface LoadedProposal {
  path: string;
  raw: string;
  body: string;
  frontmatter: StagingProposal;
}

interface VaultSnapshot {
  headSha: string;
  files: Map<string, string>;
  fileShas: Map<string, string>;
}

function isoDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function assertNoSecrets(...values: string[]): void {
  if (SECRET_PATTERNS.some((pattern) => values.some((value) => pattern.test(value)))) {
    throw new Error("Potential secret detected; it cannot be stored in the Memory Vault");
  }
}

function normalizeProposalId(value: string): string {
  if (!/^mem_[A-Za-z0-9_-]{8,}$/.test(value)) throw new Error("Invalid proposal ID");
  return value;
}

function proposalPath(id: string): string {
  return `${STAGING_PREFIX}${normalizeProposalId(id)}.md`;
}

function formalTargetPath(value: string): string {
  const normalized = normalizeVaultMarkdownPath(value);
  if (normalized.startsWith("_"))
    throw new Error("A proposal target must be in a formal Vault directory");
  return normalized;
}

function formalMetadata(proposal: StagingProposal, now: Date): MemoryFrontmatter {
  const cleaned = { ...proposal } as Record<string, unknown>;
  for (const key of [
    "reviewStatus",
    "proposedAction",
    "targetPath",
    "riskLevel",
    "operationId",
    "proposalCreatedAt",
    "reason"
  ]) {
    delete cleaned[key];
  }
  return parseMemoryFrontmatter({
    ...cleaned,
    status: "active",
    updatedAt: isoDate(now),
    ...(proposal.type === "philosophy" ? { reviewStatus: "approved" } : {})
  });
}

function makeReviewedProposal(
  raw: string,
  reviewStatus: "approved" | "rejected",
  now: Date,
  reason?: string
): string {
  const parsed = parseMarkdownFrontmatter(raw);
  return serializeMarkdownFrontmatter(
    {
      ...parsed.attributes,
      reviewStatus,
      reviewedAt: now.toISOString(),
      ...(reason ? { rejectionReason: reason } : {})
    },
    parsed.body
  );
}

function summaryOf(path: string, proposal: StagingProposal): ProposalSummary {
  return {
    id: proposal.id,
    path,
    summary: proposal.summary,
    type: proposal.type,
    targetPath: proposal.targetPath,
    proposedAction: proposal.proposedAction,
    riskLevel: proposal.riskLevel,
    proposalCreatedAt: proposal.proposalCreatedAt
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function memoryIndexEntry(
  path: string,
  raw: string,
  frontmatter: MemoryFrontmatter
): Promise<MemoryIndexEntry> {
  return {
    id: frontmatter.id,
    path,
    summary: frontmatter.summary,
    type: frontmatter.type,
    topics: frontmatter.topics,
    status: frontmatter.status,
    pinned: frontmatter.pinned,
    ...(frontmatter.project ? { project: frontmatter.project } : {}),
    ...(frontmatter.scope ? { scope: frontmatter.scope } : {}),
    updatedAt: frontmatter.updatedAt,
    ...(frontmatter.validUntil ? { validUntil: frontmatter.validUntil } : {}),
    related: frontmatter.related ?? [],
    contentHash: await sha256(raw)
  };
}

function isMemoryIndexEntry(value: unknown): value is MemoryIndexEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.path === "string" &&
    typeof entry.summary === "string" &&
    typeof entry.type === "string" &&
    Array.isArray(entry.topics) &&
    typeof entry.status === "string" &&
    typeof entry.pinned === "boolean" &&
    typeof entry.updatedAt === "string" &&
    Array.isArray(entry.related) &&
    typeof entry.contentHash === "string"
  );
}

function buildRoutingDocument(
  entries: Array<Awaited<ReturnType<typeof memoryIndexEntry>>>,
  now: Date
): string {
  const active = entries.filter(
    (entry) => entry.status === "active" && !entry.path.startsWith("_")
  );
  const projects = active.filter(
    (entry) => entry.type === "project-state" && entry.project !== "example-project"
  );
  const goals = active.filter((entry) => entry.type === "goal");
  const pinned = active.filter((entry) => entry.pinned);
  const links = (items: typeof active, empty: string): string =>
    items.length > 0
      ? items.map((entry) => `- [${entry.summary}](${entry.path})`).join("\n")
      : `- ${empty}`;
  return `# AI Memory Vault

## Purpose

Provide concise, approved, source-linked context to AI clients.

## Always-on rules

- Read only the memories needed for the current purpose.
- Prefer active, fresh, approved memories.
- Put AI-authored candidates in \`_staging/\`.
- Never store secrets.

## Active projects

${links(projects, "None confirmed.")}

## Current goals

${links(goals, "None confirmed.")}

## Pinned context

${links(pinned, "None confirmed.")}

## Directories

- \`profile/\`: stable user context
- \`philosophy/\`: approved values and principles
- \`projects/\`: current state, decisions, and sessions
- \`knowledge/\`: reusable verified knowledge
- \`sources/\`: external-source references
- \`_staging/\`: pending proposals

Last updated: ${now.toISOString()}
`;
}

export class AdminVaultService {
  public constructor(private readonly git: GitVaultGateway) {}

  public async dashboard(): Promise<{
    headSha: string;
    pendingCount: number;
    proposals: ProposalSummary[];
  }> {
    const { headSha, files } = await this.#snapshot();
    const proposals = this.#pendingProposals(files).map(({ path, proposal }) =>
      summaryOf(path, proposal)
    );
    return { headSha, pendingCount: proposals.length, proposals };
  }

  public async listProposals(): Promise<{ headSha: string; proposals: ProposalSummary[] }> {
    const { headSha, files } = await this.#snapshot();
    return {
      headSha,
      proposals: this.#pendingProposals(files)
        .map(({ path, proposal }) => summaryOf(path, proposal))
        .sort((left, right) => right.proposalCreatedAt.localeCompare(left.proposalCreatedAt))
    };
  }

  public async getProposal(
    id: string
  ): Promise<{ headSha: string; proposal: LoadedProposal; diff: string }> {
    const snapshot = await this.#snapshot();
    const proposal = this.#readProposal(snapshot.files, id);
    const current = (await this.#readPath(snapshot, proposal.frontmatter.targetPath)) ?? "";
    const after =
      proposal.frontmatter.proposedAction === "archive"
        ? ""
        : serializeMarkdownFrontmatter(
            formalMetadata(proposal.frontmatter, new Date()),
            proposal.body
          );
    return {
      headSha: snapshot.headSha,
      proposal,
      diff: createWholeFileDiff(current, after, proposal.frontmatter.targetPath)
    };
  }

  public async approve(input: {
    id: string;
    expectedHeadSha: string;
    acknowledgeHighRisk: boolean;
  }): Promise<{ headSha: string; alreadyApplied?: boolean }> {
    const now = new Date();
    const snapshot = await this.#snapshot();
    const { headSha, files } = snapshot;
    this.#assertExpectedHead(headSha, input.expectedHeadSha);
    const stagePath = proposalPath(input.id);
    if (!files.has(stagePath)) {
      if (snapshot.fileShas.has(`_archive/approved/${input.id}.md`))
        return { headSha, alreadyApplied: true };
      throw new Error("Pending proposal not found");
    }
    const proposal = this.#readProposal(files, input.id);
    if (proposal.frontmatter.riskLevel === "high" && !input.acknowledgeHighRisk) {
      throw new Error("High-risk proposal requires explicit acknowledgement");
    }
    const targetPath = formalTargetPath(proposal.frontmatter.targetPath);
    const targetExists = snapshot.fileShas.has(targetPath);
    if (proposal.frontmatter.proposedAction === "create" && targetExists) {
      throw new Error(`Create target already exists: ${targetPath}`);
    }
    if (proposal.frontmatter.proposedAction !== "create" && !targetExists) {
      throw new Error(`Proposal target does not exist: ${targetPath}`);
    }
    const changes: GitChange[] = [
      {
        path: `_archive/approved/${input.id}.md`,
        content: makeReviewedProposal(proposal.raw, "approved", now)
      },
      { path: stagePath, content: null }
    ];
    if (proposal.frontmatter.proposedAction === "archive") {
      const target = parseMarkdownFrontmatter((await this.#readPath(snapshot, targetPath)) ?? "");
      const archived = parseMemoryFrontmatter({
        ...target.attributes,
        status: "archived",
        updatedAt: isoDate(now)
      });
      changes.push({
        path: `_archive/${targetPath}`,
        content: serializeMarkdownFrontmatter(archived, target.body)
      });
      changes.push({ path: targetPath, content: null });
    } else {
      changes.push({
        path: targetPath,
        content: serializeMarkdownFrontmatter(
          formalMetadata(proposal.frontmatter, now),
          proposal.body
        )
      });
    }
    changes.push(...(await this.#derivedChanges(files, changes, now)));
    return this.git.commitChanges({
      expectedHeadSha: input.expectedHeadSha,
      changes,
      message: `memory: approve ${input.id}`
    });
  }

  public async reject(input: {
    id: string;
    expectedHeadSha: string;
    reason: string;
  }): Promise<{ headSha: string; alreadyApplied?: boolean }> {
    const now = new Date();
    const snapshot = await this.#snapshot();
    const { headSha, files } = snapshot;
    this.#assertExpectedHead(headSha, input.expectedHeadSha);
    const stagePath = proposalPath(input.id);
    if (!files.has(stagePath)) {
      if (snapshot.fileShas.has(`_archive/rejected/${input.id}.md`))
        return { headSha, alreadyApplied: true };
      throw new Error("Pending proposal not found");
    }
    const proposal = this.#readProposal(files, input.id);
    const changes: GitChange[] = [
      {
        path: `_archive/rejected/${input.id}.md`,
        content: makeReviewedProposal(proposal.raw, "rejected", now, input.reason)
      },
      { path: stagePath, content: null }
    ];
    changes.push(...(await this.#derivedChanges(files, changes, now)));
    return this.git.commitChanges({
      expectedHeadSha: input.expectedHeadSha,
      changes,
      message: `memory: reject ${input.id}`
    });
  }

  public async addInbox(input: {
    expectedHeadSha: string;
    title: string;
    content: string;
    source: string;
  }): Promise<{ headSha: string; path: string }> {
    assertNoSecrets(input.title, input.content, input.source);
    const snapshot = await this.#snapshot();
    const { headSha } = snapshot;
    this.#assertExpectedHead(headSha, input.expectedHeadSha);
    const now = new Date();
    const slug =
      input.title
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "inbox";
    const path = `_inbox/${isoDate(now)}-${slug}-${crypto.randomUUID().slice(0, 8)}.md`;
    if (snapshot.fileShas.has(path))
      throw new Error("Generated Inbox path unexpectedly exists; retry the request");
    const raw = serializeMarkdownFrontmatter(
      {
        title: input.title,
        source: [input.source],
        status: "inbox",
        receivedAt: now.toISOString()
      },
      input.content
    );
    const result = await this.git.commitChanges({
      expectedHeadSha: input.expectedHeadSha,
      changes: [{ path, content: raw }],
      message: `memory: add inbox ${slug}`
    });
    return { ...result, path };
  }

  async #snapshot(): Promise<VaultSnapshot> {
    const headSha = await this.git.getHeadSha();
    const entries = await this.git.getTreeEntries(headSha);
    const fileShas = new Map(entries.map((entry) => [entry.path, entry.sha]));
    const required = entries.filter(
      (entry) =>
        entry.path === "_state/index.json" ||
        (entry.path.startsWith(STAGING_PREFIX) && entry.path.endsWith(".md"))
    );
    const loaded = await Promise.all(
      required.map((entry) => this.git.readFile(entry.path, entry.sha))
    );
    return {
      headSha,
      files: new Map(loaded.map((file) => [file.path, file.content])),
      fileShas
    };
  }

  async #readPath(snapshot: VaultSnapshot, path: string): Promise<string | null> {
    const cached = snapshot.files.get(path);
    if (cached !== undefined) return cached;
    const sha = snapshot.fileShas.get(path);
    if (!sha) return null;
    const file = await this.git.readFile(path, sha);
    snapshot.files.set(path, file.content);
    return file.content;
  }

  #readProposal(files: Map<string, string>, id: string): LoadedProposal {
    const path = proposalPath(id);
    const raw = files.get(path);
    if (!raw) throw new Error("Pending proposal not found");
    const parsed = parseMarkdownFrontmatter(raw);
    const frontmatter = stagingProposalSchema.parse(parsed.attributes);
    if (proposalIdFromPath(path) !== frontmatter.id)
      throw new Error("Proposal filename and ID do not match");
    formalTargetPath(frontmatter.targetPath);
    return { path, raw, body: parsed.body, frontmatter };
  }

  #pendingProposals(
    files: Map<string, string>
  ): Array<{ path: string; proposal: StagingProposal }> {
    const proposals: Array<{ path: string; proposal: StagingProposal }> = [];
    for (const [path, raw] of files) {
      if (!path.startsWith(STAGING_PREFIX) || !path.endsWith(".md")) continue;
      try {
        const parsed = parseMarkdownFrontmatter(raw);
        const proposal = stagingProposalSchema.parse(parsed.attributes);
        if (proposalIdFromPath(path) === proposal.id) proposals.push({ path, proposal });
      } catch {
        // Non-memory files in staging are deliberately not review candidates.
      }
    }
    return proposals;
  }

  async #derivedChanges(
    files: Map<string, string>,
    baseChanges: GitChange[],
    now: Date
  ): Promise<GitChange[]> {
    const indexRaw = files.get("_state/index.json");
    if (!indexRaw)
      throw new Error("Vault index is missing; rebuild the index before approving a proposal");
    const parsedIndex: unknown = JSON.parse(indexRaw);
    if (
      typeof parsedIndex !== "object" ||
      parsedIndex === null ||
      !Array.isArray((parsedIndex as { entries?: unknown }).entries)
    ) {
      throw new Error("Vault index is invalid; rebuild the index before approving a proposal");
    }
    const existingEntries = (parsedIndex as { entries: unknown[] }).entries;
    if (!existingEntries.every(isMemoryIndexEntry)) {
      throw new Error("Vault index is invalid; rebuild the index before approving a proposal");
    }
    const entriesByPath = new Map(existingEntries.map((entry) => [entry.path, entry]));
    for (const change of baseChanges) {
      if (!change.path.endsWith(".md")) continue;
      if (change.content === null) {
        entriesByPath.delete(change.path);
        continue;
      }
      try {
        const parsed = parseMarkdownFrontmatter(change.content);
        entriesByPath.set(
          change.path,
          await memoryIndexEntry(
            change.path,
            change.content,
            parseMemoryFrontmatter(parsed.attributes)
          )
        );
      } catch {
        entriesByPath.delete(change.path);
      }
    }
    const entries = [...entriesByPath.values()].sort((left, right) =>
      left.path.localeCompare(right.path)
    );
    const index = {
      schemaVersion: 1,
      generatedAt: now.toISOString(),
      entries
    };
    return [
      { path: "_state/index.json", content: `${JSON.stringify(index, null, 2)}\n` },
      { path: "MEMORY.md", content: buildRoutingDocument(entries, now) }
    ];
  }

  #assertExpectedHead(actual: string, expected: string): void {
    if (actual !== expected) {
      throw new Error("Vault changed since this screen was loaded. Refresh and review again.");
    }
  }
}

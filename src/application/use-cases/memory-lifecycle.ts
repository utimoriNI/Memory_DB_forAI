import { randomUUID } from "node:crypto";
import path from "node:path";
import matter from "gray-matter";
import { parseMemoryFrontmatter, type MemoryFrontmatter } from "../../domain/memory/schema.js";
import {
  proposedActionSchema,
  stagingProposalSchema,
  type StagingProposal
} from "../../domain/staging/schema.js";
import type { IndexRepository } from "../../infrastructure/index/index-repository.js";
import type { MarkdownRepository } from "../../infrastructure/markdown/markdown-repository.js";
import { RoutingIndexService } from "./refresh-routing-index.js";

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|access[_-]?token|password)\s*[:=]\s*\S+/i,
  /\bsk-[A-Za-z0-9_-]{20,}\b/
];

const currentDate = (now: Date): string => now.toISOString().slice(0, 10);
const createMemoryId = (): string => `mem_${randomUUID().replaceAll("-", "")}`;

function normalizeSlug(value: string): string {
  const slug = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return slug || "entry";
}

function assertNoSecrets(...values: string[]): void {
  if (SECRET_PATTERNS.some((pattern) => values.some((value) => pattern.test(value)))) {
    throw new Error("Potential secret detected; secrets cannot be stored in the Memory Vault");
  }
}

function forcedRisk(type: string, action: string): "low" | "high" {
  return ["identity", "preference", "philosophy", "decision"].includes(type) ||
    ["merge", "supersede", "archive"].includes(action)
    ? "high"
    : "low";
}

export interface ProposeMemoryInput {
  frontmatter: Record<string, unknown>;
  body: string;
  targetPath: string;
  proposedAction?: "create" | "update" | "merge" | "supersede" | "archive" | undefined;
  operationId?: string | undefined;
  reason?: string | undefined;
  now?: Date | undefined;
}

export interface ApprovalResult {
  operationId: string;
  proposalPath: string;
  targetPath: string;
  action: string;
  backupPath?: string;
  diff: string;
}

export class MemoryLifecycleService {
  public constructor(
    private readonly markdown: MarkdownRepository,
    private readonly indexRepository: IndexRepository
  ) {}

  public async addInbox(input: {
    title: string;
    content: string;
    source: string;
    operationId?: string | undefined;
    receivedAt?: string | undefined;
    now?: Date | undefined;
  }): Promise<string> {
    assertNoSecrets(input.content, input.source);
    const now = input.now ?? new Date();
    const operationId = input.operationId ?? randomUUID();
    const relativePath = `_inbox/${currentDate(now)}-${normalizeSlug(input.title)}-${normalizeSlug(operationId).slice(0, 12)}.md`;
    if (await this.markdown.fileSystem.exists(relativePath)) return relativePath;
    const content = matter.stringify(`${input.content.trim()}\n`, {
      title: input.title,
      source: [input.source],
      status: "inbox",
      operationId,
      receivedAt: input.receivedAt ?? now.toISOString()
    });
    await this.markdown.writeSystemDocument(relativePath, content, { createOnly: true });
    return relativePath;
  }

  public async propose(input: ProposeMemoryInput): Promise<string> {
    assertNoSecrets(input.body, JSON.stringify(input.frontmatter));
    const now = input.now ?? new Date();
    const action = proposedActionSchema.parse(input.proposedAction ?? "create");
    const id = typeof input.frontmatter.id === "string" ? input.frontmatter.id : createMemoryId();
    const operationId = input.operationId ?? randomUUID();
    const date = currentDate(now);
    const targetPath = this.#assertFormalTarget(input.targetPath);
    const targetExists = await this.markdown.fileSystem.exists(targetPath);
    if (action === "create" && targetExists) {
      throw new Error(`Create target already exists: ${targetPath}`);
    }
    if (action !== "create" && !targetExists) {
      throw new Error(`Proposal target does not exist: ${targetPath}`);
    }
    const existingId = await this.markdown.findById(id);
    if (action === "create" && existingId) {
      throw new Error(`Memory ID already exists at ${existingId.path}`);
    }
    const proposal = stagingProposalSchema.parse({
      ...input.frontmatter,
      id,
      status: "staged",
      createdAt: input.frontmatter.createdAt ?? date,
      updatedAt: date,
      reviewStatus: "pending",
      proposedAction: action,
      targetPath,
      riskLevel: forcedRisk(String(input.frontmatter.type), action),
      operationId,
      proposalCreatedAt: now.toISOString(),
      ...(input.reason ? { reason: input.reason } : {})
    });
    const proposalPath = `_staging/${proposal.id}.md`;
    if (await this.markdown.fileSystem.exists(proposalPath)) {
      const existing = await this.markdown.readProposal(proposalPath);
      if (existing.frontmatter.operationId === operationId) return proposalPath;
      throw new Error(`A proposal already exists for ID ${proposal.id}`);
    }
    await this.markdown.writeProposal(proposalPath, proposal, input.body, { createOnly: true });
    await this.#rebuild(now);
    return proposalPath;
  }

  public async listPending(): Promise<Array<{ path: string; proposal: StagingProposal }>> {
    const files = await this.markdown.listMarkdown({ includeStaging: true });
    const proposals: Array<{ path: string; proposal: StagingProposal }> = [];
    for (const file of files.filter((entry) => entry.startsWith("_staging/"))) {
      const document = await this.markdown.readProposal(file);
      proposals.push({ path: file, proposal: document.frontmatter });
    }
    return proposals.sort((left, right) =>
      right.proposal.proposalCreatedAt.localeCompare(left.proposal.proposalCreatedAt)
    );
  }

  public async diff(proposalPath: string, now = new Date()): Promise<string> {
    const proposal = await this.markdown.readProposal(proposalPath);
    const proposed = this.markdown.serialize(
      this.#formalMetadata(proposal.frontmatter, now),
      proposal.body
    );
    const current = (await this.markdown.fileSystem.exists(proposal.frontmatter.targetPath))
      ? await this.markdown.fileSystem.readText(proposal.frontmatter.targetPath)
      : "";
    return this.#simpleDiff(current, proposed, proposal.frontmatter.targetPath);
  }

  public async approve(
    proposalPath: string,
    options: { acknowledgeHighRisk?: boolean | undefined; now?: Date | undefined } = {}
  ): Promise<ApprovalResult> {
    if (!(await this.markdown.fileSystem.exists(proposalPath))) {
      const archivedProposal = `_archive/approved/${path.posix.basename(proposalPath)}`;
      if (await this.markdown.fileSystem.exists(archivedProposal)) {
        const parsed = matter(await this.markdown.fileSystem.readText(archivedProposal));
        const operationId = String(parsed.data.operationId ?? "");
        const operationRecord = `_state/operations/${normalizeSlug(operationId)}.json`;
        if (operationId && (await this.markdown.fileSystem.exists(operationRecord))) {
          return JSON.parse(
            await this.markdown.fileSystem.readText(operationRecord)
          ) as ApprovalResult;
        }
      }
    }
    const proposalDocument = await this.markdown.readProposal(proposalPath);
    const proposal = proposalDocument.frontmatter;
    const operationRecord = `_state/operations/${normalizeSlug(proposal.operationId)}.json`;
    if (await this.markdown.fileSystem.exists(operationRecord)) {
      return JSON.parse(await this.markdown.fileSystem.readText(operationRecord)) as ApprovalResult;
    }
    if (proposal.riskLevel === "high" && !options.acknowledgeHighRisk) {
      throw new Error("High-risk proposal requires explicit acknowledgement");
    }
    const targetExists = await this.markdown.fileSystem.exists(proposal.targetPath);
    if (proposal.proposedAction === "create" && targetExists) {
      throw new Error(`Create target already exists: ${proposal.targetPath}`);
    }
    if (proposal.proposedAction !== "create" && !targetExists) {
      throw new Error(`Proposal target does not exist: ${proposal.targetPath}`);
    }
    const now = options.now ?? new Date();
    const before = targetExists ? await this.markdown.fileSystem.readText(proposal.targetPath) : "";
    let backupPath: string | undefined;
    if (proposal.proposedAction === "archive") {
      const target = await this.markdown.readMemory(proposal.targetPath);
      const archived = parseMemoryFrontmatter({
        ...target.frontmatter,
        status: "archived",
        updatedAt: currentDate(now)
      });
      const archiveUpdate = await this.markdown.writeMemory(
        proposal.targetPath,
        archived,
        target.body,
        { backup: true }
      );
      backupPath = archiveUpdate.backupPath;
      await this.markdown.fileSystem.move(proposal.targetPath, `_archive/${proposal.targetPath}`);
    } else {
      const result = await this.markdown.writeMemory(
        proposal.targetPath,
        this.#formalMetadata(proposal, now),
        proposalDocument.body,
        { createOnly: proposal.proposedAction === "create", backup: targetExists }
      );
      backupPath = result.backupPath;
    }
    const after =
      proposal.proposedAction === "archive"
        ? ""
        : await this.markdown.fileSystem.readText(proposal.targetPath);
    const result: ApprovalResult = {
      operationId: proposal.operationId,
      proposalPath,
      targetPath: proposal.targetPath,
      action: proposal.proposedAction,
      ...(backupPath ? { backupPath } : {}),
      diff: this.#simpleDiff(before, after, proposal.targetPath)
    };
    await this.markdown.fileSystem.writeTextAtomic(
      operationRecord,
      `${JSON.stringify(result, null, 2)}\n`,
      { createOnly: true }
    );
    await this.#archiveProposal(proposalPath, proposalDocument.raw, "approved", now);
    await this.#rebuild(now);
    return result;
  }

  public async reject(proposalPath: string, reason: string, now = new Date()): Promise<string> {
    const proposal = await this.markdown.readProposal(proposalPath);
    const parsed = matter(proposal.raw);
    const rejected = matter.stringify(parsed.content, {
      ...parsed.data,
      reviewStatus: "rejected",
      rejectionReason: reason,
      reviewedAt: now.toISOString()
    });
    await this.markdown.writeSystemDocument(proposalPath, rejected, { backup: true });
    const destination = `_archive/rejected/${path.posix.basename(proposalPath)}`;
    await this.markdown.fileSystem.move(proposalPath, destination);
    await this.#rebuild(now);
    return destination;
  }

  public async archiveMemory(
    relativePath: string,
    approved: boolean,
    now = new Date()
  ): Promise<string> {
    if (!approved) throw new Error("Archiving requires explicit approval");
    this.#assertFormalTarget(relativePath);
    const document = await this.markdown.readMemory(relativePath);
    const metadata = parseMemoryFrontmatter({
      ...document.frontmatter,
      status: "archived",
      updatedAt: currentDate(now)
    });
    await this.markdown.writeMemory(relativePath, metadata, document.body, { backup: true });
    const destination = `_archive/${relativePath}`;
    await this.markdown.fileSystem.move(relativePath, destination);
    await this.#rebuild(now);
    return destination;
  }

  #formalMetadata(proposal: StagingProposal, now: Date): MemoryFrontmatter {
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
      updatedAt: currentDate(now),
      ...(proposal.type === "philosophy" ? { reviewStatus: "approved" } : {})
    });
  }

  #assertFormalTarget(targetPath: string): string {
    const normalized = this.markdown.fileSystem.normalizeRelativePath(targetPath);
    if (normalized.startsWith("_") || !normalized.endsWith(".md")) {
      throw new Error("Proposal target must be a formal Markdown path");
    }
    return normalized;
  }

  async #archiveProposal(
    proposalPath: string,
    raw: string,
    outcome: "approved",
    now: Date
  ): Promise<void> {
    const parsed = matter(raw);
    const reviewed = matter.stringify(parsed.content, {
      ...parsed.data,
      reviewStatus: outcome,
      reviewedAt: now.toISOString()
    });
    await this.markdown.writeSystemDocument(proposalPath, reviewed, { backup: true });
    await this.markdown.fileSystem.move(
      proposalPath,
      `_archive/approved/${path.posix.basename(proposalPath)}`
    );
  }

  #simpleDiff(before: string, after: string, targetPath: string): string {
    if (before === after) return "No changes";
    const removed = before
      ? before
          .split("\n")
          .map((line) => `-${line}`)
          .join("\n")
      : "";
    const added = after
      ? after
          .split("\n")
          .map((line) => `+${line}`)
          .join("\n")
      : "";
    return [`--- a/${targetPath}`, `+++ b/${targetPath}`, removed, added]
      .filter(Boolean)
      .join("\n");
  }

  async #rebuild(now: Date): Promise<void> {
    await this.indexRepository.rebuild(now);
    await new RoutingIndexService(this.markdown, this.indexRepository).refresh(now);
  }
}

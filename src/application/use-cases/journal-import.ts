import { createHash } from "node:crypto";
import { journalImportEntrySchema, type JournalImportEntry } from "../../domain/journal/schema.js";
import type { MemoryLifecycleService } from "./memory-lifecycle.js";

export interface JournalImportResult {
  path: string;
  entryId: string;
  version: number;
  operationId: string;
  contentHash: string;
  source: string;
}

function canonicalPayload(entry: JournalImportEntry): string {
  return JSON.stringify({
    entryId: entry.entryId,
    version: entry.version,
    recordedAt: entry.recordedAt,
    journalPath: entry.journalPath,
    summary: entry.summary,
    transcript: entry.transcript ?? "",
    topics: entry.topics,
    project: entry.project ?? null
  });
}

function calculateContentHash(entry: JournalImportEntry): string {
  return `sha256:${createHash("sha256").update(canonicalPayload(entry), "utf8").digest("hex")}`;
}

export class JournalImportService {
  public constructor(private readonly lifecycle: MemoryLifecycleService) {}

  public async importEntry(input: unknown): Promise<JournalImportResult> {
    const entry = journalImportEntrySchema.parse(input);
    const contentHash = calculateContentHash(entry);
    if (entry.contentHash && entry.contentHash !== contentHash) {
      throw new Error("Journal contentHash does not match the supplied entry");
    }

    const source = `journal:entry:${entry.entryId}:v${entry.version}`;
    const operationId = `journal:${entry.entryId}:v${entry.version}:${contentHash.slice(-16)}`;
    const date = entry.recordedAt.slice(0, 10);
    const projectLine = entry.project ? `- Project: \`${entry.project}\`\n` : "";
    const topicsLine = entry.topics.length > 0 ? `- Topics: ${entry.topics.join(", ")}\n` : "";
    const transcript = entry.transcript ? `\n## Transcript\n\n${entry.transcript}\n` : "";
    const content = `# Journal entry\n\n- Entry ID: \`${entry.entryId}\`\n- Version: ${entry.version}\n- Recorded at: ${entry.recordedAt}\n- Journal path: \`${entry.journalPath}\`\n- Content hash: \`${contentHash}\`\n${projectLine}${topicsLine}\n## Summary\n\n${entry.summary}\n${transcript}\n## Import guidance\n\nClassify this source as a session, decision, goal, project-state, or reusable knowledge candidate. Check for duplicates, conflicts, and supersession before proposing formal memory.\n`;

    const path = await this.lifecycle.addInbox({
      title: `Journal ${date} ${entry.entryId}`,
      content,
      source,
      operationId
    });

    return {
      path,
      entryId: entry.entryId,
      version: entry.version,
      operationId,
      contentHash,
      source
    };
  }
}

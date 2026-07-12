import type { MemoryIndex, MemoryIndexEntry } from "../../domain/search/types.js";
import type { MarkdownRepository } from "../markdown/markdown-repository.js";

const INDEX_PATH = "_state/index.json";

export class IndexRepository {
  public constructor(private readonly markdown: MarkdownRepository) {}

  public async rebuild(now = new Date()): Promise<MemoryIndex> {
    const entries: MemoryIndexEntry[] = [];
    const files = await this.markdown.listMarkdown({ includeStaging: true, includeArchived: true });
    for (const file of files) {
      try {
        const document = await this.markdown.readMemory(file);
        const metadata = document.frontmatter;
        entries.push({
          id: metadata.id,
          path: file,
          summary: metadata.summary,
          type: metadata.type,
          topics: metadata.topics,
          status: metadata.status,
          pinned: metadata.pinned,
          ...(metadata.project ? { project: metadata.project } : {}),
          ...(metadata.scope ? { scope: metadata.scope } : {}),
          updatedAt: metadata.updatedAt,
          ...(metadata.validUntil ? { validUntil: metadata.validUntil } : {}),
          related: metadata.related ?? [],
          contentHash: document.contentHash
        });
      } catch {
        // Routing documents and changelogs are not formal memory index entries.
      }
    }
    const formalEntries = entries.filter(
      (entry) => !entry.path.startsWith("_staging/") && !entry.path.startsWith("_archive/")
    );
    const duplicateIds = formalEntries.filter(
      (entry, index) => formalEntries.findIndex((other) => other.id === entry.id) !== index
    );
    if (duplicateIds.length > 0) {
      throw new Error(
        `Duplicate memory IDs: ${[...new Set(duplicateIds.map((entry) => entry.id))].join(", ")}`
      );
    }
    const index: MemoryIndex = {
      schemaVersion: 1,
      generatedAt: now.toISOString(),
      entries: entries.sort((left, right) => left.path.localeCompare(right.path))
    };
    await this.markdown.fileSystem.writeTextAtomic(
      INDEX_PATH,
      `${JSON.stringify(index, null, 2)}\n`
    );
    return index;
  }

  public async read(): Promise<MemoryIndex> {
    const raw = await this.markdown.fileSystem.readText(INDEX_PATH);
    const parsed = JSON.parse(raw) as Partial<MemoryIndex>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries) || !parsed.generatedAt) {
      throw new Error("Invalid memory index; rebuild it from Markdown");
    }
    return parsed as MemoryIndex;
  }
}

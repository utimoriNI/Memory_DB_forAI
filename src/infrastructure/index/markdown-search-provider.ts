import type {
  MemoryIndexEntry,
  MemorySearchProvider,
  MemorySearchQuery,
  MemorySearchResult
} from "../../domain/search/types.js";
import type { IndexRepository } from "./index-repository.js";
import type { MarkdownRepository } from "../markdown/markdown-repository.js";

const DEFAULT_EXCLUDED_STATUSES = new Set(["deprecated", "archived"]);

function includesAll(haystack: readonly string[], needles: readonly string[]): boolean {
  const normalized = new Set(haystack.map((item) => item.toLowerCase()));
  return needles.every((needle) => normalized.has(needle.toLowerCase()));
}

function pathAllowed(entry: MemoryIndexEntry, query: MemorySearchQuery): boolean {
  if (!query.includeStaging && entry.path.startsWith("_staging/")) return false;
  if (!query.includeArchived && entry.path.startsWith("_archive/")) return false;
  if (!query.statuses && DEFAULT_EXCLUDED_STATUSES.has(entry.status)) return false;
  if (entry.validUntil && entry.validUntil < new Date().toISOString().slice(0, 10)) return false;
  return true;
}

export class MarkdownSearchProvider implements MemorySearchProvider {
  public constructor(
    private readonly indexRepository: IndexRepository,
    private readonly markdown: MarkdownRepository
  ) {}

  public async search(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    const index = await this.indexRepository.read();
    const text = query.query.trim().toLowerCase();
    const results: MemorySearchResult[] = [];
    for (const entry of index.entries) {
      if (!pathAllowed(entry, query)) continue;
      if (query.types && !query.types.includes(entry.type)) continue;
      if (query.statuses && !query.statuses.includes(entry.status)) continue;
      if (query.project && entry.project !== query.project) continue;
      if (query.topics && !includesAll(entry.topics, query.topics)) continue;
      if (query.scopes && !includesAll(entry.scope ?? [], query.scopes)) continue;

      const matchedIn: string[] = [];
      let score = entry.pinned ? 20 : 0;
      if (!text) {
        score += 1;
      } else {
        if (entry.id.toLowerCase() === text) {
          score += 100;
          matchedIn.push("id");
        }
        if (entry.path.toLowerCase().includes(text)) {
          score += 30;
          matchedIn.push("path");
        }
        if (entry.summary.toLowerCase().includes(text)) {
          score += 50;
          matchedIn.push("summary");
        }
        if (entry.topics.some((topic) => topic.toLowerCase().includes(text))) {
          score += 40;
          matchedIn.push("topics");
        }
        if (matchedIn.length === 0) {
          const document = await this.markdown.read(entry.path);
          if (document.body.toLowerCase().includes(text)) {
            score += 10;
            matchedIn.push("body");
          }
        }
        if (matchedIn.length === 0) continue;
      }
      const ageDays = Math.max(0, (Date.now() - Date.parse(entry.updatedAt)) / 86_400_000);
      score += Math.max(0, 10 - ageDays / 30);
      results.push({ entry, score, matchedIn });
    }
    return results
      .sort(
        (left, right) =>
          right.score - left.score || right.entry.updatedAt.localeCompare(left.entry.updatedAt)
      )
      .slice(0, query.limit ?? 20);
  }
}

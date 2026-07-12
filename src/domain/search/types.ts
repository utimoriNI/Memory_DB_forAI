import type { MemoryFrontmatter } from "../memory/schema.js";

export interface MemoryIndexEntry {
  id: string;
  path: string;
  summary: string;
  type: MemoryFrontmatter["type"];
  topics: string[];
  status: MemoryFrontmatter["status"];
  pinned: boolean;
  project?: string;
  scope?: string[];
  updatedAt: string;
  validUntil?: string;
  related: string[];
  contentHash: string;
}

export interface MemoryIndex {
  schemaVersion: 1;
  generatedAt: string;
  entries: MemoryIndexEntry[];
}

export interface MemorySearchQuery {
  query: string;
  types?: MemoryFrontmatter["type"][] | undefined;
  topics?: string[] | undefined;
  project?: string | undefined;
  statuses?: MemoryFrontmatter["status"][] | undefined;
  scopes?: string[] | undefined;
  includeStaging?: boolean | undefined;
  includeArchived?: boolean | undefined;
  limit?: number | undefined;
}

export interface MemorySearchResult {
  entry: MemoryIndexEntry;
  score: number;
  matchedIn: string[];
}

export interface MemorySearchProvider {
  search(query: MemorySearchQuery): Promise<MemorySearchResult[]>;
}

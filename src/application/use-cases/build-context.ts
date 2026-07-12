import type {
  MemorySearchProvider,
  MemorySearchQuery,
  MemorySearchResult
} from "../../domain/search/types.js";
import type { MarkdownRepository } from "../../infrastructure/markdown/markdown-repository.js";

export type ContextPurpose =
  "project-resume" | "technical-decision" | "writing" | "planning" | "general";

export interface BuildContextInput {
  purpose: ContextPurpose;
  query?: string | undefined;
  project?: string | undefined;
  maxFiles?: number | undefined;
  maxCharacters?: number | undefined;
}

export interface ContextFile {
  path: string;
  reason: string;
  content: string;
}

export interface BuiltContext {
  purpose: ContextPurpose;
  files: ContextFile[];
  totalCharacters: number;
  truncated: boolean;
}

export class ContextBuilder {
  public constructor(
    private readonly markdown: MarkdownRepository,
    private readonly searchProvider: MemorySearchProvider
  ) {}

  public async build(input: BuildContextInput): Promise<BuiltContext> {
    const maxFiles = input.maxFiles ?? 20;
    const maxCharacters = input.maxCharacters ?? 50_000;
    const candidates: Array<{ path: string; reason: string }> = [];
    if (await this.markdown.fileSystem.exists("MEMORY.md")) {
      candidates.push({ path: "MEMORY.md", reason: "Vault routing index" });
    }
    if (input.project) {
      const statePath = `projects/${input.project}/STATE.md`;
      if (await this.markdown.fileSystem.exists(statePath)) {
        candidates.push({ path: statePath, reason: "Current project state" });
      }
    }
    const searches = this.#searchesFor(input);
    for (const search of searches) {
      for (const result of await this.searchProvider.search(search.query)) {
        candidates.push({ path: result.entry.path, reason: search.reason(result) });
      }
    }
    if (input.project) {
      const referencesPath = `projects/${input.project}/references.md`;
      if (await this.markdown.fileSystem.exists(referencesPath)) {
        candidates.push({ path: referencesPath, reason: "Project source references" });
      }
    }

    const unique = candidates.filter(
      (candidate, index) => candidates.findIndex((other) => other.path === candidate.path) === index
    );
    const files: ContextFile[] = [];
    let totalCharacters = 0;
    let truncated = unique.length > maxFiles;
    for (const candidate of unique.slice(0, maxFiles)) {
      const content = await this.markdown.fileSystem.readText(candidate.path);
      if (totalCharacters + content.length > maxCharacters) {
        truncated = true;
        break;
      }
      files.push({ ...candidate, content });
      totalCharacters += content.length;
    }
    return { purpose: input.purpose, files, totalCharacters, truncated };
  }

  #searchesFor(input: BuildContextInput): Array<{
    query: Parameters<MemorySearchProvider["search"]>[0];
    reason: (result: MemorySearchResult) => string;
  }> {
    const common: MemorySearchQuery = {
      query: input.query ?? "",
      limit: 8,
      ...(input.project ? { project: input.project } : {})
    };
    switch (input.purpose) {
      case "project-resume":
        return [
          {
            query: { ...common, types: ["philosophy"] },
            reason: () => "Applicable project philosophy"
          },
          { query: { ...common, types: ["decision"] }, reason: () => "Recent project decision" },
          {
            query: { ...common, types: ["session"], limit: 3 },
            reason: () => "Recent work session"
          }
        ];
      case "technical-decision":
        return [
          {
            query: { ...common, types: ["decision", "philosophy", "preference", "knowledge"] },
            reason: (result) =>
              `Technical decision evidence (${result.matchedIn.join(", ") || "filter"})`
          },
          { query: { ...common, types: ["source"] }, reason: () => "External source reference" }
        ];
      case "writing":
        return [
          {
            query: { ...common, types: ["style", "philosophy", "identity", "knowledge"] },
            reason: () => "Writing guidance and domain context"
          }
        ];
      case "planning":
        return [
          {
            query: { ...common, types: ["goal", "philosophy", "decision"] },
            reason: () => "Planning constraint or objective"
          }
        ];
      case "general":
        return [
          {
            query: common,
            reason: (result) => `General relevance (${result.matchedIn.join(", ") || "filter"})`
          }
        ];
    }
  }
}

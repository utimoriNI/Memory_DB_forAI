import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";

export interface ObsidianSearchInput {
  query: string;
  pathPrefix?: string | undefined;
  tags?: string[] | undefined;
  frontmatter?: Record<string, string> | undefined;
  limit?: number | undefined;
}

export interface ObsidianNote {
  path: string;
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export class ObsidianReadOnlyAdapter {
  readonly #root: string;

  public constructor(root: string) {
    this.#root = path.resolve(root);
  }

  public async get(relativePath: string): Promise<ObsidianNote> {
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes("\0")) {
      throw new Error("Obsidian path must be relative");
    }
    const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
    if (normalized === ".." || normalized.startsWith("../") || !normalized.endsWith(".md")) {
      throw new Error("Invalid Obsidian note path");
    }
    const canonicalRoot = await realpath(this.#root);
    const canonicalFile = await realpath(path.resolve(this.#root, normalized));
    if (!isWithin(canonicalRoot, canonicalFile))
      throw new Error("Obsidian path escapes configured root");
    const parsed = matter(await readFile(canonicalFile, "utf8"));
    const heading = parsed.content.match(/^#\s+(.+)$/m)?.[1];
    return {
      path: normalized,
      title: String(parsed.data.title ?? heading ?? path.basename(normalized, ".md")),
      frontmatter: parsed.data,
      body: parsed.content.trim()
    };
  }

  public async search(input: ObsidianSearchInput): Promise<ObsidianNote[]> {
    const canonicalRoot = await realpath(this.#root);
    const files = await fg("**/*.md", {
      cwd: canonicalRoot,
      onlyFiles: true,
      followSymbolicLinks: false
    });
    const query = input.query.toLowerCase();
    const results: ObsidianNote[] = [];
    for (const file of files.sort()) {
      if (input.pathPrefix && !file.startsWith(input.pathPrefix)) continue;
      const note = await this.get(file);
      const tags = Array.isArray(note.frontmatter.tags)
        ? note.frontmatter.tags.map(String)
        : typeof note.frontmatter.tags === "string"
          ? [note.frontmatter.tags]
          : [];
      if (input.tags && !input.tags.every((tag) => tags.includes(tag))) continue;
      if (
        input.frontmatter &&
        !Object.entries(input.frontmatter).every(
          ([key, value]) => String(note.frontmatter[key]) === value
        )
      )
        continue;
      if (query && !`${note.path}\n${note.title}\n${note.body}`.toLowerCase().includes(query))
        continue;
      results.push(note);
      if (results.length >= (input.limit ?? 20)) break;
    }
    return results;
  }
}

import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

export interface JournalReflection {
  date: string;
  relativePath: string;
  content: string;
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid Journal reflection date: ${value}`);
  }
  return value;
}

export class JournalReflectionReader {
  readonly #root: string;

  public constructor(root: string) {
    this.#root = path.resolve(root);
  }

  public async list(dates?: readonly string[]): Promise<JournalReflection[]> {
    const canonicalRoot = await realpath(this.#root);
    const relativePaths = dates
      ? dates.map((date) => `reflection/${assertDate(date)}.md`)
      : await fg("reflection/*.md", {
          cwd: canonicalRoot,
          onlyFiles: true,
          unique: true,
          followSymbolicLinks: false
        });
    const reflections: JournalReflection[] = [];

    for (const relativePath of relativePaths.sort()) {
      const normalized = relativePath.split(path.sep).join("/");
      if (!/^reflection\/\d{4}-\d{2}-\d{2}\.md$/.test(normalized)) continue;
      const candidate = path.resolve(canonicalRoot, normalized);
      if (!isWithin(canonicalRoot, candidate)) {
        throw new Error(`Journal path escapes the configured root: ${normalized}`);
      }
      let canonicalFile: string;
      try {
        canonicalFile = await realpath(candidate);
      } catch {
        continue;
      }
      if (!isWithin(canonicalRoot, canonicalFile)) {
        throw new Error(`Journal symlink escapes the configured root: ${normalized}`);
      }
      if (!(await stat(canonicalFile)).isFile()) continue;
      const match = normalized.match(/^reflection\/(\d{4}-\d{2}-\d{2})\.md$/);
      if (!match?.[1]) continue;
      const content = (await readFile(canonicalFile, "utf8")).trim();
      if (!content) continue;
      reflections.push({ date: match[1], relativePath: normalized, content });
    }

    return reflections;
  }
}

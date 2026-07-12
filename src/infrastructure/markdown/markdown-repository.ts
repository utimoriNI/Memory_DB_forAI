import { createHash } from "node:crypto";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import { parseMemoryFrontmatter, type MemoryFrontmatter } from "../../domain/memory/schema.js";
import { stagingProposalSchema, type StagingProposal } from "../../domain/staging/schema.js";
import type { VaultFileSystem } from "../filesystem/vault-filesystem.js";

export interface MarkdownDocument<T = Record<string, unknown>> {
  path: string;
  frontmatter: T;
  body: string;
  raw: string;
  contentHash: string;
}

export class MarkdownRepository {
  public constructor(readonly fileSystem: VaultFileSystem) {}

  public async read(relativePath: string): Promise<MarkdownDocument> {
    const normalized = this.fileSystem.normalizeRelativePath(relativePath);
    const raw = await this.fileSystem.readText(normalized);
    const parsed = matter(raw);
    return {
      path: normalized,
      frontmatter: parsed.data,
      body: parsed.content.trim(),
      raw,
      contentHash: createHash("sha256").update(raw, "utf8").digest("hex")
    };
  }

  public async readMemory(relativePath: string): Promise<MarkdownDocument<MemoryFrontmatter>> {
    const document = await this.read(relativePath);
    return { ...document, frontmatter: parseMemoryFrontmatter(document.frontmatter) };
  }

  public async writeMemory(
    relativePath: string,
    frontmatter: unknown,
    body: string,
    options: { createOnly?: boolean; backup?: boolean } = {}
  ): Promise<{ backupPath?: string }> {
    const validated = parseMemoryFrontmatter(frontmatter);
    return this.fileSystem.writeTextAtomic(relativePath, this.serialize(validated, body), options);
  }

  public async readProposal(relativePath: string): Promise<MarkdownDocument<StagingProposal>> {
    const document = await this.read(relativePath);
    return { ...document, frontmatter: stagingProposalSchema.parse(document.frontmatter) };
  }

  public async writeProposal(
    relativePath: string,
    frontmatter: unknown,
    body: string,
    options: { createOnly?: boolean; backup?: boolean } = {}
  ): Promise<{ backupPath?: string }> {
    const validated = stagingProposalSchema.parse(frontmatter);
    return this.fileSystem.writeTextAtomic(relativePath, this.serialize(validated, body), options);
  }

  public async writeSystemDocument(
    relativePath: string,
    content: string,
    options: { createOnly?: boolean; backup?: boolean } = {}
  ): Promise<{ backupPath?: string }> {
    return this.fileSystem.writeTextAtomic(
      relativePath,
      content.endsWith("\n") ? content : `${content}\n`,
      options
    );
  }

  public serialize(frontmatter: object, body: string): string {
    return matter.stringify(`${body.trim()}\n`, frontmatter);
  }

  public async listMarkdown(
    options: { includeStaging?: boolean | undefined; includeArchived?: boolean | undefined } = {}
  ): Promise<string[]> {
    await this.fileSystem.initialize();
    const ignored = ["**/node_modules/**"];
    if (!options.includeStaging) ignored.push("_staging/**");
    if (!options.includeArchived) ignored.push("_archive/**");
    return fg("**/*.md", {
      cwd: this.fileSystem.root,
      onlyFiles: true,
      unique: true,
      followSymbolicLinks: false,
      ignore: ignored
    }).then((paths) => paths.map((entry) => entry.split(path.sep).join("/")).sort());
  }

  public async findById(
    id: string,
    options: { includeStaging?: boolean | undefined; includeArchived?: boolean | undefined } = {}
  ): Promise<MarkdownDocument<MemoryFrontmatter> | null> {
    for (const file of await this.listMarkdown(options)) {
      try {
        const document = await this.readMemory(file);
        if (document.frontmatter.id === id) return document;
      } catch {
        // System documents without common Frontmatter are intentionally skipped.
      }
    }
    return null;
  }
}

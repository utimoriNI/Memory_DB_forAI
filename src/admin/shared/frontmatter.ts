import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface ParsedMarkdown {
  attributes: Record<string, unknown>;
  body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses the restricted YAML-frontmatter form used by this Vault. */
export function parseMarkdownFrontmatter(raw: string): ParsedMarkdown {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    throw new Error("A formal memory document must start with YAML frontmatter");
  }
  const firstBreak = raw.indexOf("\n");
  const endMarker = raw.indexOf("\n---", firstBreak + 1);
  if (endMarker < 0) throw new Error("YAML frontmatter closing marker is missing");
  const markerEnd = raw.indexOf("\n", endMarker + 1);
  const yaml = raw.slice(firstBreak + 1, endMarker);
  const attributes: unknown = parseYaml(yaml);
  if (!isRecord(attributes)) throw new Error("YAML frontmatter must be an object");
  return {
    attributes,
    body: markerEnd < 0 ? "" : raw.slice(markerEnd + 1).trim()
  };
}

export function serializeMarkdownFrontmatter(
  attributes: Record<string, unknown>,
  body: string
): string {
  const yaml = stringifyYaml(attributes, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

export function normalizeVaultMarkdownPath(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.includes("\0") ||
    !normalized.endsWith(".md")
  ) {
    throw new Error("Invalid Vault Markdown path");
  }
  return normalized;
}

export function proposalIdFromPath(value: string): string {
  const path = normalizeVaultMarkdownPath(value);
  if (!path.startsWith("_staging/") || path.slice("_staging/".length).includes("/")) {
    throw new Error("Proposal path must be a direct _staging Markdown file");
  }
  return path.slice("_staging/".length, -3);
}

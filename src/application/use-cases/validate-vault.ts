import type { MarkdownRepository } from "../../infrastructure/markdown/markdown-repository.js";

export interface VaultValidationReport {
  valid: boolean;
  checkedMemories: number;
  pinnedCount: number;
  errors: Array<{ path: string; message: string }>;
  warnings: string[];
}

export async function validateVault(
  markdown: MarkdownRepository,
  pinnedWarningLimit = 20
): Promise<VaultValidationReport> {
  const errors: Array<{ path: string; message: string }> = [];
  const warnings: string[] = [];
  const ids = new Map<string, string>();
  let checkedMemories = 0;
  let pinnedCount = 0;
  for (const file of await markdown.listMarkdown({ includeStaging: true, includeArchived: true })) {
    // Inbox documents are unclassified source material, not formal memories.
    if (file.startsWith("_inbox/")) continue;
    try {
      const document = file.startsWith("_staging/")
        ? await markdown.readProposal(file)
        : await markdown.readMemory(file);
      checkedMemories += 1;
      if (document.frontmatter.pinned) pinnedCount += 1;
      if (!file.startsWith("_")) {
        const existing = ids.get(document.frontmatter.id);
        if (existing) errors.push({ path: file, message: `Duplicate ID also used by ${existing}` });
        else ids.set(document.frontmatter.id, file);
      }
    } catch (error) {
      const raw = await markdown.read(file);
      if (Object.keys(raw.frontmatter).length > 0 && !file.startsWith("_archive/")) {
        errors.push({
          path: file,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  if (pinnedCount > pinnedWarningLimit) {
    warnings.push(
      `Pinned memory count ${pinnedCount} exceeds configured limit ${pinnedWarningLimit}`
    );
  }
  return { valid: errors.length === 0, checkedMemories, pinnedCount, errors, warnings };
}

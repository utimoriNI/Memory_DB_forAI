import type { IndexRepository } from "../../infrastructure/index/index-repository.js";
import type { MarkdownRepository } from "../../infrastructure/markdown/markdown-repository.js";

export class RoutingIndexService {
  public constructor(
    private readonly markdown: MarkdownRepository,
    private readonly indexRepository: IndexRepository
  ) {}

  public async refresh(now = new Date()): Promise<void> {
    const index = await this.indexRepository.read();
    const active = index.entries.filter(
      (entry) => entry.status === "active" && !entry.path.startsWith("_")
    );
    const projects = active.filter(
      (entry) => entry.type === "project-state" && entry.project !== "example-project"
    );
    const goals = active.filter((entry) => entry.type === "goal");
    const pinned = active.filter((entry) => entry.pinned);
    const links = (entries: typeof active, empty: string): string =>
      entries.length > 0
        ? entries.map((entry) => `- [${entry.summary}](${entry.path})`).join("\n")
        : `- ${empty}`;
    const content = `# AI Memory Vault

## Purpose

Provide concise, approved, source-linked context to AI clients.

## Always-on rules

- Read only the memories needed for the current purpose.
- Prefer active, fresh, approved memories.
- Put AI-authored candidates in \`_staging/\`.
- Never store secrets.

## Active projects

${links(projects, "None confirmed.")}

## Current goals

${links(goals, "None confirmed.")}

## Pinned context

${links(pinned, "None confirmed.")}

## Directories

- \`profile/\`: stable user context
- \`philosophy/\`: approved values and principles
- \`projects/\`: current state, decisions, and sessions
- \`knowledge/\`: reusable verified knowledge
- \`sources/\`: external-source references
- \`_staging/\`: pending proposals

Last updated: ${now.toISOString()}
`;
    await this.markdown.writeSystemDocument("MEMORY.md", content, { backup: true });
  }
}

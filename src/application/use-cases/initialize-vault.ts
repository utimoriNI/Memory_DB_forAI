import type { IndexRepository } from "../../infrastructure/index/index-repository.js";
import type { MarkdownRepository } from "../../infrastructure/markdown/markdown-repository.js";
import { RoutingIndexService } from "./refresh-routing-index.js";

const DIRECTORIES = [
  "profile",
  "philosophy/principles",
  "philosophy/implementation-principles",
  "philosophy/practical-ethics",
  "philosophy/themes",
  "knowledge",
  "projects/example-project/decisions",
  "projects/example-project/knowledge",
  "projects/example-project/sessions",
  "goals",
  "people",
  "sources/obsidian",
  "sources/raindrop",
  "sources/chat",
  "sources/codex",
  "_inbox",
  "_staging",
  "_archive/rejected",
  "_archive/approved",
  "_state",
  "scripts"
] as const;

export class VaultInitializer {
  public constructor(
    private readonly markdown: MarkdownRepository,
    private readonly indexRepository: IndexRepository
  ) {}

  public async initialize(now = new Date()): Promise<void> {
    await this.markdown.fileSystem.initialize();
    for (const directory of DIRECTORIES) {
      await this.markdown.fileSystem
        .writeTextAtomic(`${directory}/.gitkeep`, "", {
          createOnly: !(await this.markdown.fileSystem.exists(`${directory}/.gitkeep`))
        })
        .catch((error: unknown) => {
          if (!(error instanceof Error && error.message.includes("overwrite"))) throw error;
        });
    }
    const date = now.toISOString().slice(0, 10);
    await this.#createSystem(
      "MEMORY.md",
      `# AI Memory Vault\n\n## Purpose\n\nProvide concise, approved, source-linked context to AI clients.\n\n## Always-on rules\n\n- Read only the memories needed for the current purpose.\n- Prefer active, fresh, approved memories.\n- Put AI-authored candidates in \`_staging/\`.\n- Never store secrets.\n\n## Active projects\n\n- None confirmed.\n\n## Current goals\n\n- None confirmed.\n\n## Pinned context\n\n- [Identity](profile/identity.md)\n- [Preferences](profile/preferences.md)\n- [Style](profile/style.md)\n- [Philosophy overview](philosophy/OVERVIEW.md)\n\n## Directories\n\n- \`profile/\`: stable user context\n- \`philosophy/\`: approved values and principles\n- \`projects/\`: current state, decisions, and sessions\n- \`knowledge/\`: reusable verified knowledge\n- \`sources/\`: external-source references\n- \`_staging/\`: pending proposals\n\nLast updated: ${date}\n`
    );
    await this.#createSystem(
      "AGENT.md",
      "# Vault agent rules\n\n1. Read `MEMORY.md` at session start.\n2. Do not read all files indiscriminately.\n3. Prefer `status: active`; normally ignore deprecated and archived entries.\n4. Check `updatedAt`, `lastReviewedAt`, provenance, duplicates, conflicts, and supersession.\n5. Put AI-created memories in `_staging/`; never write them directly to formal areas.\n6. Never activate philosophy or infer profile/preferences from one statement without approval.\n7. Prefer archive over deletion and rebuild indexes after approved changes.\n8. Never store secrets.\n"
    );
    await this.#createSystem(
      "README.md",
      "# AI Memory Vault\n\nThis directory is an AI-oriented context store. Markdown is authoritative; `_state/` is derived. Use the MCP server or repository scripts to propose, approve, search, and rebuild it.\n"
    );
    await this.#createSystem(
      "philosophy/OVERVIEW.md",
      `# Philosophy overview\n\nNo philosophy has been approved yet. AI-generated additions must be proposed in \`_staging/\`.\n\nLast updated: ${date}\n`
    );
    await this.#createSystem(
      "philosophy/CHANGELOG.md",
      `# Philosophy changelog\n\n- ${date}: Vault initialized; no approved philosophy recorded.\n`
    );
    await this.#createSystem(
      "projects/example-project/references.md",
      "# References\n\nNo references recorded.\n"
    );
    await this.#createMemory(
      "profile/identity.md",
      "mem_system_identity",
      "No confirmed identity information is stored",
      "identity",
      date,
      "# Identity\n\nNo confirmed identity information is stored. Use staging proposals for additions."
    );
    await this.#createMemory(
      "profile/preferences.md",
      "mem_system_preferences",
      "No confirmed preferences are stored",
      "preference",
      date,
      "# Preferences\n\nNo confirmed preferences are stored. Use staging proposals for additions."
    );
    await this.#createMemory(
      "profile/style.md",
      "mem_system_style",
      "No confirmed writing style is stored",
      "style",
      date,
      "# Style\n\nNo confirmed style is stored. Use staging proposals for additions."
    );
    await this.#createMemory(
      "projects/example-project/STATE.md",
      "mem_system_example_state",
      "Example project is an inactive structural placeholder",
      "project-state",
      date,
      "# Example project state\n\n- Project: Example project\n- Purpose: Demonstrate the required project structure\n- State: inactive placeholder\n- Current phase: not started\n- Current goal: none\n- Completed: Vault scaffold\n- Next: replace this project with a real project through an approved proposal\n- Blockers: none\n- Open questions: none\n- Assumptions: this file is only a scaffold\n- Decisions: none\n- Applied philosophy: none\n- Last updated: " +
        date
    );
    await this.#createMemory(
      "projects/example-project/overview.md",
      "mem_system_example_project",
      "Example project directory documentation",
      "project",
      date,
      "# Example project\n\nThis placeholder demonstrates the project layout and is not an active user project."
    );
    await this.indexRepository.rebuild(now);
    await new RoutingIndexService(this.markdown, this.indexRepository).refresh(now);
  }

  async #createSystem(relativePath: string, content: string): Promise<void> {
    if (!(await this.markdown.fileSystem.exists(relativePath))) {
      await this.markdown.writeSystemDocument(relativePath, content, { createOnly: true });
    }
  }

  async #createMemory(
    relativePath: string,
    id: string,
    summary: string,
    type: "identity" | "preference" | "style" | "project" | "project-state",
    date: string,
    body: string
  ): Promise<void> {
    if (!(await this.markdown.fileSystem.exists(relativePath))) {
      await this.markdown.writeMemory(
        relativePath,
        {
          id,
          summary,
          type,
          topics: [],
          status: "active",
          pinned: type === "identity" || type === "preference" || type === "style",
          source: ["system:vault-initialization"],
          project: type.startsWith("project") ? "example-project" : null,
          createdAt: date,
          updatedAt: date,
          lastReviewedAt: date,
          validUntil: null,
          supersedes: [],
          related: []
        },
        body,
        { createOnly: true }
      );
    }
  }
}

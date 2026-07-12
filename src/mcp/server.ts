import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ZodType } from "zod";
import { ContextBuilder } from "../application/use-cases/build-context.js";
import { VaultInitializer } from "../application/use-cases/initialize-vault.js";
import { MemoryLifecycleService } from "../application/use-cases/memory-lifecycle.js";
import { RoutingIndexService } from "../application/use-cases/refresh-routing-index.js";
import type { AppConfig } from "../config/env.js";
import type { MemorySearchQuery } from "../domain/search/types.js";
import { VaultFileSystem } from "../infrastructure/filesystem/vault-filesystem.js";
import { IndexRepository } from "../infrastructure/index/index-repository.js";
import { MarkdownSearchProvider } from "../infrastructure/index/markdown-search-provider.js";
import type { Logger } from "pino";
import { MarkdownRepository } from "../infrastructure/markdown/markdown-repository.js";
import { ObsidianReadOnlyAdapter } from "../infrastructure/obsidian/obsidian-readonly-adapter.js";
import {
  MockRaindropSearchProvider,
  type RaindropSearchProvider
} from "../infrastructure/raindrop/provider.js";
import {
  archiveInputSchema,
  buildContextInputSchema,
  emptyInputSchema,
  inboxAddInputSchema,
  memoryGetInputSchema,
  memorySearchInputSchema,
  obsidianGetInputSchema,
  obsidianReferenceInputSchema,
  obsidianSearchInputSchema,
  projectStateInputSchema,
  proposeInputSchema,
  raindropReferenceInputSchema,
  raindropSearchInputSchema,
  specializedSearchInputSchema,
  stagingApproveInputSchema,
  stagingPathInputSchema,
  stagingRejectInputSchema
} from "./schemas/tools.js";

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

function success(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function failure(error: unknown): ToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({
          code: "MEMORY_TOOL_ERROR",
          message: error instanceof Error ? error.message : String(error)
        })
      }
    ]
  };
}

function compactSearchInput(input: {
  query: string;
  types?: MemorySearchQuery["types"] | undefined;
  topics?: string[] | undefined;
  project?: string | undefined;
  statuses?: MemorySearchQuery["statuses"] | undefined;
  includeStaging?: boolean | undefined;
  includeArchived?: boolean | undefined;
  limit?: number | undefined;
}): MemorySearchQuery {
  return {
    query: input.query,
    ...(input.types ? { types: input.types } : {}),
    ...(input.topics ? { topics: input.topics } : {}),
    ...(input.project ? { project: input.project } : {}),
    ...(input.statuses ? { statuses: input.statuses } : {}),
    ...(input.includeStaging !== undefined ? { includeStaging: input.includeStaging } : {}),
    ...(input.includeArchived !== undefined ? { includeArchived: input.includeArchived } : {}),
    ...(input.limit ? { limit: input.limit } : {})
  };
}

export async function createMemoryMcpServer(
  config: AppConfig,
  logger: Logger,
  raindrop: RaindropSearchProvider = new MockRaindropSearchProvider()
): Promise<McpServer> {
  const fileSystem = new VaultFileSystem(config.vaultPath);
  const markdown = new MarkdownRepository(fileSystem);
  const index = new IndexRepository(markdown);
  const search = new MarkdownSearchProvider(index, markdown);
  const context = new ContextBuilder(markdown, search);
  const lifecycle = new MemoryLifecycleService(markdown, index);
  await new VaultInitializer(markdown, index).initialize();

  const server = new McpServer({ name: "ai-memory-system", version: "0.1.0" });
  const register = <T>(
    name: string,
    description: string,
    schema: ZodType<T>,
    handler: (input: T) => Promise<unknown>
  ): void => {
    server.registerTool(name, { description, inputSchema: schema }, async (input) => {
      try {
        return success(await handler(input));
      } catch (error) {
        logger.warn(
          { tool: name, error: error instanceof Error ? error.message : String(error) },
          "MCP tool failed"
        );
        return failure(error);
      }
    });
  };

  register(
    "memory_read_index",
    "Read the short MEMORY.md routing index",
    emptyInputSchema,
    async () => ({ path: "MEMORY.md", content: await fileSystem.readText("MEMORY.md") })
  );
  register(
    "memory_search",
    "Search approved memory with structured filters",
    memorySearchInputSchema,
    async (input) => search.search(compactSearchInput(input))
  );
  register(
    "memory_get",
    "Get a memory by ID or safe Vault-relative path",
    memoryGetInputSchema,
    async (input) => {
      if (input.idOrPath.includes("/") || input.idOrPath.endsWith(".md"))
        return markdown.read(input.idOrPath);
      const found = await markdown.findById(input.idOrPath, {
        includeStaging: input.includeStaging,
        includeArchived: input.includeArchived
      });
      if (!found) throw new Error(`Memory not found: ${input.idOrPath}`);
      return found;
    }
  );
  register(
    "memory_build_context",
    "Build bounded purpose-specific AI context with selection reasons",
    buildContextInputSchema,
    async (input) => context.build(input)
  );
  register(
    "project_get_state",
    "Read a project's current STATE.md snapshot",
    projectStateInputSchema,
    async (input) => markdown.readMemory(`projects/${input.project}/STATE.md`)
  );
  register(
    "decision_search",
    "Search decision memories",
    specializedSearchInputSchema,
    async (input) => search.search(compactSearchInput({ ...input, types: ["decision"] }))
  );
  register(
    "philosophy_search",
    "Search philosophy memories",
    specializedSearchInputSchema,
    async (input) => search.search(compactSearchInput({ ...input, types: ["philosophy"] }))
  );
  register("staging_list", "List pending proposals", emptyInputSchema, async () =>
    lifecycle.listPending()
  );
  register(
    "staging_diff",
    "Diff a proposal against its formal target",
    stagingPathInputSchema,
    async (input) => ({ diff: await lifecycle.diff(input.proposalPath) })
  );
  register(
    "inbox_add",
    "Add unclassified source material to _inbox",
    inboxAddInputSchema,
    async (input) => ({ path: await lifecycle.addInbox(input) })
  );
  register(
    "memory_propose",
    "Create an unapproved memory proposal",
    proposeInputSchema,
    async (input) => ({ path: await lifecycle.propose(input) })
  );
  register(
    "memory_propose_update",
    "Propose an update without changing formal memory",
    proposeInputSchema,
    async (input) => ({ path: await lifecycle.propose({ ...input, proposedAction: "update" }) })
  );
  register(
    "philosophy_propose",
    "Create an unapproved high-risk philosophy proposal",
    proposeInputSchema,
    async (input) => ({
      path: await lifecycle.propose({
        ...input,
        frontmatter: { ...input.frontmatter, type: "philosophy" }
      })
    })
  );
  register(
    "project_propose_state_update",
    "Propose a project STATE.md update",
    proposeInputSchema,
    async (input) => ({
      path: await lifecycle.propose({
        ...input,
        frontmatter: { ...input.frontmatter, type: "project-state" },
        proposedAction: "update"
      })
    })
  );
  register(
    "staging_approve",
    "Explicitly approve and promote a proposal",
    stagingApproveInputSchema,
    async (input) =>
      lifecycle.approve(input.proposalPath, { acknowledgeHighRisk: input.acknowledgeHighRisk })
  );
  register(
    "staging_reject",
    "Reject and archive a proposal",
    stagingRejectInputSchema,
    async (input) => ({ path: await lifecycle.reject(input.proposalPath, input.reason) })
  );
  register(
    "memory_archive",
    "Archive formal memory after explicit approval",
    archiveInputSchema,
    async (input) => ({ path: await lifecycle.archiveMemory(input.path, input.approved) })
  );
  register(
    "index_rebuild",
    "Rebuild the derived JSON index from Markdown",
    emptyInputSchema,
    async () => {
      const rebuilt = await index.rebuild();
      await new RoutingIndexService(markdown, index).refresh();
      return rebuilt;
    }
  );
  register(
    "obsidian_search",
    "Search the configured read-only Obsidian Vault",
    obsidianSearchInputSchema,
    async (input) => {
      if (!config.obsidianVaultPath) throw new Error("OBSIDIAN_VAULT_PATH is not configured");
      return new ObsidianReadOnlyAdapter(config.obsidianVaultPath).search(input);
    }
  );
  register(
    "obsidian_get",
    "Read one note from the configured read-only Obsidian Vault",
    obsidianGetInputSchema,
    async (input) => {
      if (!config.obsidianVaultPath) throw new Error("OBSIDIAN_VAULT_PATH is not configured");
      return new ObsidianReadOnlyAdapter(config.obsidianVaultPath).get(input.path);
    }
  );
  register(
    "obsidian_create_reference",
    "Create a staged summary/reference to an Obsidian note",
    obsidianReferenceInputSchema,
    async (input) => {
      if (!config.obsidianVaultPath) throw new Error("OBSIDIAN_VAULT_PATH is not configured");
      const note = await new ObsidianReadOnlyAdapter(config.obsidianVaultPath).get(input.path);
      const slug = note.path
        .replace(/\.md$/i, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .toLowerCase();
      return {
        path: await lifecycle.propose({
          frontmatter: {
            summary: input.summary,
            type: "source",
            topics: input.topics,
            pinned: false,
            source: [`obsidian:${note.path}`]
          },
          body: `# ${note.title}\n\n${input.summary}\n\n- Obsidian path: \`${note.path}\``,
          targetPath: `sources/obsidian/${slug || "note"}.md`,
          ...(input.operationId ? { operationId: input.operationId } : {})
        })
      };
    }
  );
  register(
    "raindrop_search",
    "Search saved Raindrop information through the configured provider",
    raindropSearchInputSchema,
    async (input) => raindrop.search(input.query, input.limit)
  );
  register(
    "raindrop_create_reference",
    "Create a staged summary/reference to a Raindrop bookmark",
    raindropReferenceInputSchema,
    async (input) => {
      const bookmark = await raindrop.getBookmark(input.bookmarkId);
      if (!bookmark) throw new Error(`Raindrop bookmark not found: ${input.bookmarkId}`);
      const slug =
        bookmark.title
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .toLowerCase()
          .replace(/^-|-$/g, "")
          .slice(0, 70) || "bookmark";
      return {
        path: await lifecycle.propose({
          frontmatter: {
            summary: input.summary,
            type: "source",
            topics: input.topics,
            pinned: false,
            source: [`raindrop:${bookmark.id}`]
          },
          body: `# ${bookmark.title}\n\n${input.summary}\n\n- URL: ${bookmark.url}\n- Bookmark ID: ${bookmark.id}\n- Collection: ${bookmark.collection ?? "unassigned"}\n- Tags: ${bookmark.tags.join(", ")}`,
          targetPath: `sources/raindrop/${slug}-${bookmark.id}.md`,
          ...(input.operationId ? { operationId: input.operationId } : {})
        })
      };
    }
  );
  return server;
}

export async function runMemoryMcpServer(config: AppConfig, logger: Logger): Promise<void> {
  const server = await createMemoryMcpServer(config, logger);
  await server.connect(new StdioServerTransport());
  logger.info({ vaultPath: config.vaultPath }, "AI Memory MCP server started");
}

# AI Memory System

AI Memory System is a local-first, Markdown-backed long-term context store for Codex and other MCP clients. It keeps approved memory separate from AI proposals, records provenance and freshness, and builds small purpose-specific context rather than loading an entire note collection.

The initial working implementation includes the safe Markdown repository, derived index, structured search, purpose-specific context builder, staged approval lifecycle, 23 MCP tools, read-only Obsidian search, and a replaceable Raindrop provider interface.

## Requirements

- Node.js 20 or newer
- npm

## Setup

```sh
npm install
cp .env.example .env
npm run init-vault
npm run check
npm run build
```

`MEMORY_VAULT_PATH` identifies the isolated AI Vault. `OBSIDIAN_VAULT_PATH`, when set, is read-only. No database is required.

## Commands

| Command                                           | Purpose                                         |
| ------------------------------------------------- | ----------------------------------------------- |
| `npm run dev`                                     | Run the MCP server in watch mode                |
| `npm run build`                                   | Compile production ESM into `dist/`             |
| `npm run init-vault`                              | Create the Vault and conservative starter files |
| `npm run validate-vault`                          | Validate Frontmatter, IDs, and pinned limits    |
| `npm run rebuild-index`                           | Regenerate `_state/index.json` from Markdown    |
| `npm run export-context -- general query project` | Export bounded context                          |
| `npm run migrate-schema`                          | Run schema migrations (version 1 is a no-op)    |
| `npm run typecheck`                               | Type-check without emitting files               |
| `npm run lint`                                    | Run ESLint                                      |
| `npm test`                                        | Run Vitest once                                 |
| `npm run check`                                   | Format, lint, type-check, and test              |

## Codex MCP configuration

Build the server, then add this to user-level `~/.codex/config.toml` or trusted project-level `.codex/config.toml`:

```toml
[mcp_servers.ai-memory]
command = "node"
args = ["/absolute/path/to/ai-memory-system/dist/index.js"]
cwd = "/absolute/path/to/ai-memory-system"
required = true

[mcp_servers.ai-memory.env]
MEMORY_VAULT_PATH = "/absolute/path/to/ai-memory-system/memory"
OBSIDIAN_VAULT_PATH = "/absolute/path/to/obsidian-vault"
LOG_LEVEL = "info"
```

Codex documents `command`, `args`, `cwd`, and `env` for stdio MCP servers. Use absolute paths. Omit `OBSIDIAN_VAULT_PATH` when not needed, and never place API keys in the Vault. The server writes protocol messages to stdout and structured logs to stderr.

## Lifecycle safety

- Proposal tools write only under `_staging/`.
- High-risk proposals require `acknowledgeHighRisk: true` during explicit approval.
- Approved updates are backed up before atomic replacement.
- Reviewed proposals remain under `_archive/`.
- Approved mutations rebuild the index and return a Git-style diff; they do not create commits.
- Obsidian is read-only. Raindrop uses a mock until a concrete existing provider is supplied.

## Documentation

- [Architecture](docs/architecture.md)
- [Vault structure](docs/vault-structure.md)
- [Frontmatter schema](docs/frontmatter-schema.md)
- [Memory lifecycle](docs/memory-lifecycle.md)
- [Approval flow](docs/approval-flow.md)
- [Retrieval policy](docs/retrieval-policy.md)
- [MCP tools](docs/mcp-tools.md)
- [Security](docs/security.md)
- [Assumptions](docs/assumptions.md)

# AI Memory System

AI Memory System is a local-first, Markdown-backed long-term context store for Codex and other MCP clients. It keeps approved memory separate from AI proposals, records provenance and freshness, and builds small purpose-specific context rather than loading an entire note collection.

The initial working implementation includes the safe Markdown repository, derived index, structured search, purpose-specific context builder, staged approval lifecycle, 24 MCP tools, Journal source import, read-only Obsidian search, and a replaceable Raindrop provider interface.

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
| `npm run admin:dev`                               | Run the mobile admin PWA locally with Wrangler  |
| `npm run admin:deploy`                            | Deploy the mobile admin PWA and API             |
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

## Mobile approval PWA (no always-on computer)

`apps/mobile-admin/` is an installable mobile web app. Its Cloudflare Worker runs only while a request is being handled; the private Git repository remains the source of truth. The browser receives an administrator access token for the current tab only, while the GitHub write token stays in the Worker secret store.

1. Create a GitHub fine-grained token restricted to this private repository with **Contents: Read and write**.
2. Copy `.dev.vars.example` to `.dev.vars`, set the values, and run `npm run admin:dev` for local verification.
3. Authenticate Wrangler, then deploy with `npm run admin:deploy`.
4. In the Cloudflare dashboard, set `ADMIN_ACCESS_TOKEN` and `GITHUB_TOKEN` as encrypted Worker secrets; set the repository owner/name and branch as normal Worker variables.
5. Open the deployed URL on iPhone Safari and choose **ホーム画面に追加**. Enter the administrator access token when starting a new browser tab.

The app sends an expected Git HEAD SHA with every mutation. If another device changed the Vault after the screen was loaded, the Worker rejects the request and asks for a refresh. Each approval or rejection is one Git commit, so Git history is the backup and audit trail. See [mobile admin operations](docs/mobile-admin.md) for the secret boundary, recovery, and deployment checklist.

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
- [Mobile admin operations](docs/mobile-admin.md)

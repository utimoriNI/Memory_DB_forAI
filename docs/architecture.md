# Architecture

## Goals

The system exposes an MCP server over stdio, stores authoritative memory as Markdown, and generates rebuildable JSON indexes. It optimizes for traceability, controlled promotion, portability, and bounded context.

## Boundaries

```text
MCP tools -> application use cases -> domain rules
                    |                    |
                    v                    v
             application ports <- repository/search interfaces
                    |
                    v
 filesystem, Markdown, index, Obsidian, Raindrop, logging adapters
```

- `domain/`: immutable concepts, schemas, transition rules, ranking policy.
- `application/use-cases/`: orchestration for read, proposal, approval, rejection, archive, indexing, and context construction.
- `application/ports/`: repository, clock, ID, search, and external-source interfaces.
- `infrastructure/`: safe filesystem, Markdown serialization, JSON index, read-only Obsidian, Raindrop adapter, and structured logging.
- `mcp/`: Zod-validated transport adapters. It contains no lifecycle policy.
- `config/`: environment parsing and configured roots.

## Data ownership

Markdown is authoritative. `_state/index.json`, hashes, sync markers, and deduplication hints are derived. The initial search provider scans the index and only reads bodies needed for full-text matching. A `MemorySearchProvider` port permits a later SQLite or embedding implementation without changing use cases.

## Mutation boundary

AI writes are proposals. A proposal records the proposed action and target but cannot mutate formal memory. Explicit approval invokes a separate use case that validates, backs up, atomically writes, records history, and rebuilds indexes. High-risk operations require an explicit approval acknowledgement distinct from selecting the proposal.

## Implementation order

1. Toolchain, configuration, logging, rules, and documentation.
2. Frontmatter domain schema and safe Markdown/filesystem repository.
3. Derived index, search provider, and context builder.
4. Inbox/staging/approval/rejection/archive lifecycle.
5. Read MCP tools, then mutation MCP tools.
6. Read-only Obsidian and Raindrop provider adapters.
7. Evaluation scenarios, migration utility, and hardening.

## Initial implementation status

Phases 1–5 are implemented for the filesystem-backed release. The server exposes 24 tools over stdio and has an in-memory MCP integration test. Raindrop intentionally uses the provider interface and mock because no existing searcher was present. Remaining hardening includes richer semantic duplicate/conflict classification, production Raindrop integration, cross-process write locking, and broader scenario evaluation.

See [ADR-0001](adr/0001-markdown-source-of-truth.md).

## Mobile administration boundary

The optional `src/admin/worker.ts` is a Cloudflare Worker plus static PWA assets. It is not an alternative database and does not run the local MCP server. It reads and writes the same Markdown files through GitHub's Git object API, grouping a lifecycle mutation into one commit. The Worker rebuilds the derived index and routing `MEMORY.md` as part of approved/rejected mutations.

```text
iPhone PWA -- temporary admin access token --> Worker
Worker -- GitHub token kept in secret store --> private Git repository
Desktop MCP <--- local cloned Markdown Vault --- Git pull/push ---> Git repository
```

The request includes the Git commit SHA observed while the reviewer inspected the proposal. The Worker compares it before creating a tree/commit and again at ref update time, preventing a stale review from overwriting newer work.

# Investigation findings and assumptions

## Findings (2026-07-11)

- The supplied workspace was empty and was not a Git repository.
- There was no existing package configuration, MCP server, Raindrop Searcher, type model, or reusable implementation.
- Therefore the implementation starts as a greenfield Node.js/TypeScript project.
- Raindrop begins with the required provider interface and mock adapter; a concrete adapter needs a later location/API contract.

## Assumptions

- Node.js 20+ is available and MCP transport is stdio.
- One server process manages one configured AI Vault.
- Dates in Frontmatter are calendar dates; approval audit timestamps use ISO 8601 UTC.
- Memory IDs use a collision-resistant sortable generator with prefixes; imported IDs are preserved after validation.
- `MEMORY.md`, Vault `AGENT.md`, `README.md`, and changelogs are system documents and are indexed separately from formal memories when they lack common Frontmatter.
- Approval is conveyed only through `staging_approve`; high-risk operations additionally require an explicit boolean acknowledgement.
- Git initialization and commits remain user-controlled. The server returns diffs and does not invoke commits.
- No database or embedding service is introduced until benchmark evidence shows Markdown/index search is insufficient.

## Open integration inputs

- The concrete location and API of any existing Raindrop Searcher.
- The user's actual Obsidian Vault path.
- The preferred installation scope and exact Codex MCP configuration file location.

None blocks the filesystem-backed core or mock adapters.

The README shows both supported Codex config scopes: user-level `~/.codex/config.toml` and trusted project-level `.codex/config.toml`.

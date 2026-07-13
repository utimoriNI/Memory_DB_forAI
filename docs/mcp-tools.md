# MCP tools

Every tool uses a strict Zod input schema and a consistent success/error envelope. Mutation tools never infer human approval.

The initial server registers 24 tools over stdio. Tool failures return `isError: true` with stable code `MEMORY_TOOL_ERROR` and a non-secret message.

## Read tools

- `memory_read_index`: read `MEMORY.md`.
- `memory_search`: query with type/topic/project/status and staging/archive flags.
- `memory_get`: retrieve by memory ID or safe Vault-relative path.
- `memory_build_context`: construct a bounded, purpose-specific bundle with reasons.
- `project_get_state`: retrieve `projects/<slug>/STATE.md`.
- `decision_search`: search decision records.
- `philosophy_search`: search philosophy records.
- `staging_list`: list pending proposals.
- `staging_diff`: compare a proposal with its target.
- `obsidian_search`, `obsidian_get`: query the configured read-only Vault.
- `raindrop_search`: delegate to `RaindropSearchProvider`.

## Mutation tools

- `inbox_add`: add raw source material.
- `journal_import_entry`: import one validated Journal entry into `_inbox/` with provenance and content-hash idempotency.
- `memory_propose`, `memory_propose_update`: create staged proposals.
- `philosophy_propose`: create staged philosophy proposals only.
- `project_propose_state_update`: propose a state snapshot update.
- `staging_approve`: explicitly promote an approved proposal.
- `staging_reject`: archive a rejected proposal.
- `memory_archive`: explicitly archive formal memory.
- `index_rebuild`: regenerate derived index data.
- `obsidian_create_reference`, `raindrop_create_reference`: create reference proposals, never unconditional copies.

The detailed input fields follow the development directive. Outputs include selected paths/IDs, provenance, warnings, and stable machine-readable error codes.

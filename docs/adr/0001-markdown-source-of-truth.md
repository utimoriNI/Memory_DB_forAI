# ADR-0001: Markdown is the source of truth

- Status: accepted
- Date: 2026-07-11

## Decision

Store authoritative memory as Markdown with YAML Frontmatter in a user-controlled directory. Treat JSON indexes as rebuildable derivatives. Keep persistence behind repository and search ports so alternative indexes can be added without replacing the canonical representation.

## Consequences

The Vault remains portable, reviewable, and Git-friendly. Writes require stronger filesystem safety and concurrency controls. Initial search is intentionally simpler than a vector database; measurement will decide whether an additional provider is justified.

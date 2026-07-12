# AI Memory System repository rules

- Markdown files in the configured Vault are the source of truth.
- `memory/_state/index.json` is derived data and must always be reproducible from Markdown.
- Do not write directly to formal memory areas. New AI-authored memories belong in `_staging/`.
- Changes to philosophy, profile, preferences, and the meaning of existing decisions require explicit human approval.
- A project `STATE.md` describes the current state, not its history. Store past decisions in `decisions/` and session history in `sessions/`.
- Treat the Obsidian Vault as read-only.
- Treat Raindrop as a source of external references; do not copy bookmarks unconditionally.
- Never read or write outside configured roots. Defend against path traversal and symlink escapes.
- When adding a Frontmatter field, update the schema, migration logic, templates, tests, and documentation.
- Use npm only. Do not use another package manager.
- Every MCP tool needs a Zod input schema and tests for validation, success, failure shape, and idempotency where relevant.
- Update relevant documentation with implementation changes.
- Prefer archive and supersession over deletion.
- Do not store credentials, tokens, secrets, or unnecessary third-party personal data in the Vault or logs.
- Before changing a memory, search for duplicates, conflicts, and supersession relationships.
- Rebuild the index after approved mutations; do not manually edit it as authoritative data.

## Development checks

Run `npm run check` before handing off a change. Use strict TypeScript, preserve ESM `.js` import suffixes, and add unit or integration coverage proportional to the behavior changed.

# Security boundaries

- Canonicalize configured roots and requested paths.
- Reject absolute user paths and `..` traversal for Vault-relative operations.
- Walk existing path components with `realpath` and reject symlink escapes.
- Create files only after validating the nearest existing parent's canonical path.
- Use UTF-8, normalized slugs, exclusive creation where required, temporary files, `fsync`, and atomic rename.
- Back up changed targets before replacement.
- Validate Frontmatter before every formal write.
- Use operation IDs and stored outcomes for idempotency.
- Redact credential-shaped log fields and never log source bodies by default.
- Reject likely API keys, tokens, private keys, and credentials from memory proposals.
- Minimize personal and third-party information.
- Obsidian access is read-only; writes are constrained to the AI Vault.
- Journal import accepts relative source references only, does not read or write the Journal repository, and stores imported material only under `_inbox/`.
- The optional daily GitHub Actions extractor secret-screens Inbox material before model submission, sends only unprocessed Inbox text plus a compact memory-index summary, and stores `OPENAI_API_KEY` only in GitHub Actions Secrets. It creates staging candidates only.
- Raindrop credentials, if an adapter later needs them, stay in process environment and never enter Markdown.

## Mobile admin PWA

- The PWA must be served over HTTPS and only calls its own Worker origin.
- `GITHUB_TOKEN` is a Worker secret. It is never returned to, stored by, or requested from the browser.
- `ADMIN_ACCESS_TOKEN` authenticates a reviewer to the Worker. The reference PWA keeps it only in `sessionStorage`, which is cleared when the tab/session ends. Use a long random value and rotate it when a device is lost.
- Use a GitHub fine-grained token scoped to one private repository and only the `Contents` permission. A GitHub App installation token is a suitable later replacement.
- The Worker rejects likely secrets in mobile Inbox capture, validates proposal Frontmatter before promotion, enforces high-risk acknowledgement, and returns no raw GitHub provider errors to the client.
- Every mutation carries an expected HEAD SHA. Stale screens are rejected instead of being silently merged.
- Git commits provide the immutable pre-change history for the remote path. Desktop filesystem operations continue to create local backups as documented.
- The Worker only exposes a categorized GitHub failure (authentication, authorization, repository availability, or rate limit). It never returns the GitHub provider response body, token, or request headers to the browser.
- An authenticated request may receive a 12-character SHA-256 token fingerprint with a GitHub provider failure. This lets the owner compare the deployed secret with a locally held token without revealing either token value.
- GitHub REST calls include an explicit application `User-Agent`, as required by GitHub; a missing or invalid value is rejected with HTTP 403.

Filesystem checks are authorization controls, not only validation. Tests must cover traversal, symlink escape, atomicity, backup, collision, and archive behavior.

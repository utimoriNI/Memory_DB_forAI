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
- Raindrop credentials, if an adapter later needs them, stay in process environment and never enter Markdown.

Filesystem checks are authorization controls, not only validation. Tests must cover traversal, symlink escape, atomicity, backup, collision, and archive behavior.

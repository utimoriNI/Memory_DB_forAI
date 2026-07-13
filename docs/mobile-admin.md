# Mobile admin PWA

## Purpose

The mobile admin PWA makes the review queue usable from an iPhone without keeping a Mac or MCP server running. It is an operational surface for the existing lifecycle, not a replacement for the local Markdown Vault or MCP server.

## What it does

- Lists valid pending Markdown proposals from `_staging/`.
- Shows the proposed target, source, risk level, and whole-file diff.
- Requires an explicit checkbox for high-risk changes.
- Approves by creating/updating the formal target, preserving the reviewed proposal in `_archive/approved/`, rebuilding `_state/index.json` and `MEMORY.md`, and committing all changes together.
- Rejects by moving the reviewed proposal to `_archive/rejected/` in a commit and rebuilding derived data.
- Adds short mobile notes to `_inbox/`; it never promotes them directly to memory.

It deliberately does not offer direct editing of formal profile, preference, philosophy, decision, or project-state files. Those must first become reviewable proposals.

## Deployment

The Worker configuration is in `wrangler.jsonc` and static PWA files are in `apps/mobile-admin/public/`.

```sh
cp .dev.vars.example .dev.vars
# fill in non-production values in .dev.vars
npm run admin:dev

# after `wrangler login` and production secret configuration
npm run admin:deploy
```

Set these as encrypted secrets in the deployment platform:

- `GITHUB_TOKEN`: a GitHub fine-grained token limited to this private repository with Contents read/write.
- `ADMIN_ACCESS_TOKEN`: a separate long random reviewer token.

Set `GITHUB_OWNER`, `GITHUB_REPOSITORY`, and `GITHUB_BRANCH` as non-secret Worker variables. Do not place any of these in the Vault, source tree, PWA bundle, `.env`, or committed configuration.

## Review flow

1. Open the app, authenticate with the administrator access token, and choose a candidate.
2. Read its source, target path, metadata, and diff. A high-risk candidate requires a dedicated acknowledgement.
3. Tap **承認して反映** or **却下**, and supply a reason for rejection.
4. The Worker compares the displayed Git HEAD SHA with the current branch. If they differ, refresh and repeat the review.
5. Pull the new commit on each desktop before using the local MCP server. The formal Markdown is then immediately available to MCP; rebuild the local index if a pull did not include the derived index for any reason.

## Operating without a server

Cloudflare Workers start for a request and stop afterwards. There is no permanent Mac process, port forwarding, or iPhone-to-home-network dependency. GitHub is the shared synchronization point and its history is the audit log.

The reference PWA uses a simple per-tab administrator token to avoid storing a Git credential in the phone. For multiple reviewers or stronger identity controls, put the Worker behind Cloudflare Access (or replace the simple check with an organization SSO verifier) before giving access to other people.

## Recovery and limits

- A bad approval is recoverable from Git history; create a new staged correction rather than rewriting history.
- Rotate the administrator token and GitHub token after a device loss or suspected exposure.
- The initial Worker reads the repository tree to regenerate derived routing/index data. Keep the AI Memory repository focused; do not place large binary assets or an unrelated Obsidian vault in it.
- The PWA cache contains only application shell files, never Vault data or credentials. API responses are `no-store`.

# Approval flow

Approval performs these steps as one idempotent operation:

1. Resolve and validate the proposal inside `_staging/`.
2. Verify the target and expected action semantics.
3. Require explicit high-risk acknowledgement when applicable.
4. Revalidate Frontmatter and paths.
5. Back up any existing target under `_state/backups/`.
6. Write through a same-directory temporary file and atomic rename.
7. Record approval outcome and append a change record.
8. Rebuild derived indexes and routing metadata.
9. Return a Git-style diff without committing.

An operation ID and recorded proposal outcome prevent double application. Rejection records reason and timestamp, then atomically moves the proposal to `_archive/rejected/`.

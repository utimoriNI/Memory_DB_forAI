# Memory lifecycle

```text
source/log -> _inbox -> classify and compare -> _staging -> human review

                                                       |-> approve -> formal area
                                                       |-> reject  -> _archive/rejected
```

## Optional daily cloud extraction

The `daily-inbox-extraction` GitHub Actions workflow can run once per day without a Mac. It sends
only unprocessed, secret-screened Inbox items and a compact memory-index summary to the configured
OpenAI API model. It can create only new `knowledge` proposals in `_staging/`; it never promotes a
proposal or changes profile, preferences, philosophy, decisions, project state, or other formal
memory. A content-hash record under `_state/daily-inbox-extraction.json` makes unchanged Inbox
items idempotent. Configure `OPENAI_API_KEY` only as a GitHub Actions Secret.

Candidate classification is one of: new memory, update, duplicate, conflict, superseding candidate, or temporary/no retention. Every retained candidate cites its source and comparison evidence.

Journal entries are imported as read-only source material through `journal_import_entry`. The importer stores the entry in `_inbox/`, records a stable Journal reference and content hash, and never promotes the entry directly to formal memory. A later candidate proposal may create a session, decision, goal, project state, or reusable knowledge memory after duplicate/conflict checks and human review.

Formal states may be moved to reconsidering, deprecated, superseded, or archived through approved operations. Deletion is not a normal lifecycle action. The index and `MEMORY.md` are refreshed after approved mutations.

Profile and preference claims are not promoted based on a single utterance without human review. Philosophy candidates are never made active automatically.

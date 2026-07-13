# Memory lifecycle

```text
source/log -> _inbox -> classify and compare -> _staging -> human review
                                                       |-> approve -> formal area
                                                       |-> reject  -> _archive/rejected
```

Candidate classification is one of: new memory, update, duplicate, conflict, superseding candidate, or temporary/no retention. Every retained candidate cites its source and comparison evidence.

Journal entries are imported as read-only source material through `journal_import_entry`. The importer stores the entry in `_inbox/`, records a stable Journal reference and content hash, and never promotes the entry directly to formal memory. A later candidate proposal may create a session, decision, goal, project state, or reusable knowledge memory after duplicate/conflict checks and human review.

Formal states may be moved to reconsidering, deprecated, superseded, or archived through approved operations. Deletion is not a normal lifecycle action. The index and `MEMORY.md` are refreshed after approved mutations.

Profile and preference claims are not promoted based on a single utterance without human review. Philosophy candidates are never made active automatically.

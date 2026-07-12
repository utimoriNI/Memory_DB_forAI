# Memory lifecycle

```text
source/log -> _inbox -> classify and compare -> _staging -> human review
                                                       |-> approve -> formal area
                                                       |-> reject  -> _archive/rejected
```

Candidate classification is one of: new memory, update, duplicate, conflict, superseding candidate, or temporary/no retention. Every retained candidate cites its source and comparison evidence.

Formal states may be moved to reconsidering, deprecated, superseded, or archived through approved operations. Deletion is not a normal lifecycle action. The index and `MEMORY.md` are refreshed after approved mutations.

Profile and preference claims are not promoted based on a single utterance without human review. Philosophy candidates are never made active automatically.

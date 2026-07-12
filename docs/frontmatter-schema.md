# Frontmatter schema

All formal memories require:

```yaml
---
id: mem_01JXXXXXXXXXXXX
summary: AI向け長期記憶は人間向けノートとは別に設計する
type: knowledge
topics: [ai, memory]
status: active
pinned: false
confidence: 0.9
importance: medium
source: [session:2026-07-11]
scope: [personal-knowledge-management]
project: null
createdAt: 2026-07-11
updatedAt: 2026-07-11
lastReviewedAt: 2026-07-11
validUntil: null
supersedes: []
related: []
---
```

Required fields are `id`, `summary`, `type`, `topics`, `status`, `pinned`, non-empty `source`, `createdAt`, and `updatedAt`.

Allowed types: `identity`, `preference`, `style`, `philosophy`, `knowledge`, `project`, `project-state`, `decision`, `goal`, `relationship`, `session`, `source`.

Allowed statuses: `staged`, `active`, `reconsidering`, `deprecated`, `superseded`, `archived`.

Dates use `YYYY-MM-DD`. Confidence is from 0 through 1. `updatedAt` cannot precede `createdAt`; review and validity dates receive equivalent ordering checks. Pinned entries are warned on when the configured limit is exceeded.

Philosophy adds `philosophyDepth`, `reviewStatus`, `applicableScopes`, `exceptions`, `conflictsWith`, and positive integer `version`. Allowed depths are `philosophy-principle`, `implementation-principle`, `practical-ethics`, `important-theme`, and `derived-theme`.

Staging files require `status: staged`, `reviewStatus: pending`, `proposedAction`, `targetPath`, and `riskLevel`. Actions are `create`, `update`, `merge`, `supersede`, and `archive`; risks are `low`, `medium`, and `high`. Profile, preference, active philosophy, decision-semantic changes, merge, supersede, and archive are always high risk.

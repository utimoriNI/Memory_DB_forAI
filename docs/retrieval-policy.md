# Retrieval policy

Default retrieval excludes `_archive/`, `_staging/`, deprecated and archived statuses, and memories past `validUntil`. Explicit flags may include excluded areas. Ranking combines exact ID/path relevance, summary, topics, body text, filters, pinned priority, and recency. Status `active` is preferred.

Purpose-specific context selection:

| Purpose            | Ordered sources                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| project-resume     | `MEMORY.md`, project `STATE.md`, pinned philosophy, recent decisions, latest session, references |
| technical-decision | project state, related decisions, philosophy, preferences, knowledge, source references          |
| writing            | style, related philosophy, identity, domain knowledge, prior-content references                  |
| planning           | project state, goals, philosophy, decisions, blockers, next actions                              |
| general            | index plus ranked relevant memory                                                                |

Every returned file includes a selection reason. File and character budgets are applied in order; metadata identifies omitted candidates. Related IDs may expand retrieval within remaining budgets.

The first provider uses Markdown and the derived JSON index. A provider interface will allow a later search backend only after measured need.

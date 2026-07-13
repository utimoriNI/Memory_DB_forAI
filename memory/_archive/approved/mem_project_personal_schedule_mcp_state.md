---
id: mem_project_personal_schedule_mcp_state
summary: Personal Schedule MCP v1 is implemented and Google Calendar read access is verified
type: project-state
topics:
  - mcp
  - google-calendar
  - notion
  - project-state
status: staged
pinned: false
confidence: 0.95
importance: high
source:
  - codex:session-2026-07-11-to-2026-07-13
scope:
  - personal-productivity
project: personal-schedule-mcp
createdAt: 2026-07-13
updatedAt: 2026-07-13
lastReviewedAt: null
validUntil: null
supersedes: []
related: []
reviewStatus: approved
proposedAction: create
targetPath: projects/personal-schedule-mcp/STATE.md
riskLevel: low
operationId: schedule-mcp-state-20260713
proposalCreatedAt: 2026-07-13T12:52:02.845Z
reason: Initial current-state snapshot after implementation and live Google Calendar read verification.
reviewedAt: 2026-07-13T15:54:36.707Z
---

# Personal Schedule MCP state

## 人間向け要約

- Personal Schedule MCPの初期版は実装済みで、Google Calendarの読み取りも実機確認済みです。
- 次はCodexへの常設登録と、Notionへの書き込み操作の確認を行う段階です。
- iPhoneから直接使う仕組みは未解決で、別途安全なHTTP設計が必要です。

- Project: Personal Schedule MCP
- Purpose: Manage Google Calendar events and Notion tasks from MCP clients.
- Current phase: Local stdio v1 implemented and verified.
- Completed:
  - Ten MCP tools implemented, including health check, Calendar CRUD, and Notion task lifecycle operations.
  - Google OAuth configured and live Calendar event listing verified through the local MCP server.
  - Notion database mapping adapted to the actual schedule database schema.
  - Lint, strict type checking, build, formatting checks, and 21 automated tests passed.
- Current goal: Make the server available as a durable local Codex MCP and verify live Notion create, update, complete, and archive operations.
- Next:
  - Register the server in global Codex MCP configuration.
  - Verify Notion write operations with a safe test task.
  - Decide whether remote or iPhone access is needed; that requires a secured HTTP design.
- Blockers:
  - iPhone ChatGPT cannot directly invoke the local stdio server.
  - Google OAuth apps in Testing have refresh-token lifetime limitations.
- Open questions:
  - Whether to add Streamable HTTP plus private network access or a separate iPhone-oriented interface.
- Last updated: 2026-07-13

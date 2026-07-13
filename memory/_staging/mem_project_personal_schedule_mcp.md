---
id: mem_project_personal_schedule_mcp
summary: >-
  Personal Schedule MCP project: Google Calendar and Notion task management
  server
type: project
topics:
  - mcp
  - typescript
  - google-calendar
  - notion
  - personal-productivity
status: staged
pinned: false
confidence: 0.95
importance: high
source:
  - "codex:session-2026-07-11-to-2026-07-13"
scope:
  - personal-productivity
project: personal-schedule-mcp
createdAt: "2026-07-13"
updatedAt: "2026-07-13"
lastReviewedAt: null
validUntil: null
supersedes: []
related: []
reviewStatus: pending
proposedAction: create
targetPath: projects/personal-schedule-mcp/overview.md
riskLevel: low
operationId: schedule-mcp-project-20260713
proposalCreatedAt: "2026-07-13T12:52:02.844Z"
reason: >-
  New project record based on the completed local implementation and
  verification session.
---

# Personal Schedule MCP

## 人間向け要約

- Google Calendarの予定とNotionの作業タスクを、AIクライアントから扱うための新しいMCPプロジェクトです。
- 予定はGoogle Calendar、開発・学習などのタスクはNotionと役割を分けます。
- 両者を自動同期する仕組みではなく、ローカルのMCPサーバーとして使います。

## Purpose

A local TypeScript MCP server for managing fixed events in Google Calendar and work tasks in a Notion database.

## Architecture

- Transport: local stdio MCP server
- Tool layer: validates structured input and formats MCP responses
- Service layer: Google Calendar API and Notion API integrations
- Validation: Zod schemas and startup environment validation
- Logging: structured logs written to stderr

## Operational boundaries

- Fixed events such as appointments and meetings belong in Google Calendar.
- Development, study, research, and production work belong in Notion.
- Calendar and Notion are not automatically synchronized.
- The MCP server does not perform broad natural-language parsing; the client provides structured inputs.

## Integrated Notion database

The configured database uses the fields Task Name, Status Select, Category, Due Date, and Memo.

## Security

Google OAuth and Notion tokens remain in the local .env file and are intentionally excluded from this memory record.

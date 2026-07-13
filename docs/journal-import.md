# Journal import

Journal is treated as a read-only primary source. MemoryDB does not read from or write to the Journal repository through this tool; Journal or an integration process sends one validated entry to the `journal_import_entry` MCP tool.

For Codex-independent execution, `npm run journal:import` reads only `reflection/YYYY-MM-DD.md` from the configured Journal repository and imports the previous JST day's reflection by default. It writes only to MemoryDB's `_inbox/` through the existing lifecycle service.

```sh
JOURNAL_REPO_PATH=/Users/isikurahiromitu/Documents/Vaults/Journal \
MEMORY_VAULT_PATH=/Users/isikurahiromitu/Documents/AI_Memory_DB/memory \
npm run journal:import
```

Use `--date YYYY-MM-DD` for a specific day or `--all` for an explicit historical catch-up. The macOS `launchd` template is at `deploy/launchd/com.ai-memory.journal-import.plist.template`; it is configured for 07:00 local time, after Journal's 06:00 JST generation workflow.

## Import payload

```json
{
  "entryId": "journal-2026-07-13-001",
  "version": 1,
  "recordedAt": "2026-07-13T08:30:00+09:00",
  "journalPath": "entries/2026-07-13.md",
  "summary": "MemoryDBへの取り込み方を検討した",
  "transcript": "長期記憶と日記を分離したい。",
  "topics": ["memory", "workflow"],
  "project": "ai-memory-db"
}
```

`journalPath` is a relative reference only. The importer computes a SHA-256 content hash and derives an operation ID from `entryId`, `version`, and that hash. Repeating the same entry version and content returns the same `_inbox/` path. A changed entry must use a new version or content hash.

## Promotion flow

1. Call `journal_import_entry`; the result is stored under `_inbox/`.
2. Read the imported source and search MemoryDB for duplicates, conflicts, and supersession.
3. Create one or more candidates with `memory_propose` or a specialized proposal tool.
4. Review with `staging_list` and `staging_diff`.
5. Approve or reject explicitly.
6. The approval flow rebuilds the derived index.

The importer never promotes raw Journal content directly to formal memory. The transcript remains source evidence; formal memories should contain only durable, reusable claims with a `journal:entry:<entryId>:v<version>` provenance value.

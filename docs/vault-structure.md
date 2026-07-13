# Vault structure

```text
memory/
├── MEMORY.md
├── AGENT.md
├── README.md
├── profile/{identity.md,preferences.md,style.md}
├── philosophy/
│   ├── OVERVIEW.md
│   ├── principles/
│   ├── implementation-principles/
│   ├── practical-ethics/
│   ├── themes/
│   └── CHANGELOG.md
├── knowledge/
├── projects/example-project/
│   ├── STATE.md
│   ├── overview.md
│   ├── decisions/
│   ├── knowledge/
│   ├── references.md
│   └── sessions/
├── goals/
├── people/
├── sources/{obsidian,raindrop,chat,codex}/
├── _inbox/
├── _staging/
├── _archive/rejected/
├── _state/
└── scripts/
```

`MEMORY.md` is a short routing index, preferably under 100 lines. It contains purpose, always-on rules, active projects, current goals, pinned links, directory hints, and an update timestamp—never detailed history.

`STATE.md` is a current snapshot. Decisions and sessions preserve history. `_inbox/` is unclassified source material and is excluded from formal-memory Frontmatter validation; `_staging/` is unapproved memory; `_archive/` is excluded by default; `_state/` contains no memory prose.

The initializer will create this layout and conservative starter files. The human-facing Obsidian Vault remains a separate configured root.

---
title: Journal 2026-10-03
source:
  - 'journal:entry:journal-2026-10-03:v1'
status: inbox
operationId: 'journal:journal-2026-10-03:v1:109790a1818a7c59'
receivedAt: '2026-10-03T00:00:00+09:00'
---
# Journal entry

- Entry ID: `journal-2026-10-03`
- Version: 1
- Recorded at: 2026-10-03T00:00:00+09:00
- Journal path: `reflection/2026-10-03.md`
- Content hash: `sha256:49f46fc270d8f989bf39f149dc1dec7b3877810052cb2140109790a1818a7c59`
- Topics: journal, reflection

## Summary

```markdown
# 今日の要約
2026年10月3日は、ObsidianとNotionの自動化に関する作業を大半行い、スムーズなデータ管理のためのスクリプトを整備しました。また、タスクの追加やログの導線も整え、今後の作業をさらに効率化する準備をしました。

# 進めたこと
- Obsidianのデイリーノートを自動生成する機能を実装しました。
- タスク追加やログ追加の導線をScriptableで作成し、ログに日付を追加してカレンダー表示が可能になりました。
- Notion APIを利用し、ScriptableからProject DB、Ticket DB、Log DBを操作するシステムを整備しました。
- データベースIDの代わりに`data_source_id`を使用する方法に切り替えました。
- Projectページへの行き詰まり状況を追加するスクリプトを作成・修正しました。
- Ticket DBに「やりたいこと」を追加するスクリプトと、Projectを指定しない選択肢を追加する機能を実装しました。
- Log DBに作業ログを追加するスクリプトを作成し、分野を指定しない選択肢も導入しました。
- 3つのScriptableスクリプトに対して構文チェックを行いました。
- Scriptable用スクリプトはローカル上で完成し、Notion Integration TokenをKeychainから読み込む構成にしています。

# 考えたこと・気づき
NotionとObsidianの連携において、自動化によるタスクの見通しが良くなる一方で、導入までの手間がかかることも感じています。今後、このシステムを使うことでどれほど効率が上がるのか楽しみです。

# 気がかり・改善点
- Scriptableのスクリプトについて、Notionへの実レコード追加をまだ行っていないため、実際のデータ管理がどう機能するか確認が必要です。
- ダッシュボードの作成が未着手なので、次回の優先タスクにしたいです。

# 次にやること
- Notionへの実レコード追加を実施し、動作を確認します。
- ダッシュボード作成に着手し、作業内容を整理して見える化を図ります。
- 引き続きScriptableの機能向上や新しいアイデアを試し、効率的な作業管理を進めていきます。
```

## Import guidance

Classify this source as a session, decision, goal, project-state, or reusable knowledge candidate. Check for duplicates, conflicts, and supersession before proposing formal memory.

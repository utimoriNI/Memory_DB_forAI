---
id: mem_raindrop_searcher_state_20260713
summary: Raindrop と GitHub 上の Obsidian Vault を横断検索するWebアプリは、本番デプロイと差分同期を備え、検索品質・フィードバック・タグ選択を実装済み
type: project-state
topics:
  - raindrop
  - obsidian
  - semantic-search
  - vercel
  - github-actions
status: active
pinned: false
confidence: 0.95
importance: high
source:
  - codex:raindrop-searcher-session-2026-07-10-to-2026-07-13
  - git:raindrop-searcher@2db16dc
scope:
  - personal-knowledge-management
  - search
project: raindrop-searcher
createdAt: 2026-07-13
updatedAt: 2026-07-13
lastReviewedAt: 2026-07-13
validUntil: null
supersedes: []
related: []
---

# Raindrop Searcher: project state

## 人間向け要約

- RaindropのブックマークとObsidianノートを、ひとつのWebアプリで横断検索するプロジェクトの現在地です。
- 本番デプロイ、定期同期、検索改善、検索結果への評価機能まで実装済みです。
- Webhookの本番確認や、検索結果の復元管理などが次の改善点として残っています。

- Project: Raindrop Searcher
- Purpose: Raindrop.io のブックマークと、GitHub 上の Obsidian Vault を一つのWebアプリで検索する。
- Phase: 本番運用の基盤と検索改善を実装済み。運用検証とUXの仕上げが残る。
- Current goal: 個人のWeb保存とObsidianメモを、関連度の高い順で安全に横断検索できる状態を維持・改善する。

## Architecture and operation

- App: Next.js を Vercel にデプロイ。標準URLは `https://raindrop-searcher.vercel.app`。
- Data: ローカルは SQLite、本番は Turso/libSQL を利用する構成。
- Access control: `APP_ACCESS_TOKEN` によるログインと署名済み HttpOnly Cookie で検索UI/APIを保護。管理操作は別の `APP_ADMIN_TOKEN` を使用する。
- Raindrop sync: Raindrop API からブックマーク、本文、タグ、要約、embeddingを同期する。
- Obsidian sync: GitHub App で Vault を読み、`🎁Topic/` で始まるタグを持つ Markdown だけを対象にする。初回は全件、以後は GitHub Compare API によるコミット差分のみを同期する。
- Scheduling: Vercel Hobby のCron制限を避け、GitHub Actions が Raindrop 同期と Obsidian 同期を分離して定期実行する。`main` へのpushはGitHub ActionsでVercelへデプロイする。
- Webhook: `/api/github/webhook` はGitHubのPush通知を署名検証して受け、変更コミットを記録する。実際の索引更新はGitHub Actionsの定期または手動同期が実施する。

## Completed

- Raindrop と Obsidian の統合検索UI。検索結果はソース、タグ、パスなどを表示して区別する。
- Obsidian の GitHub同期、`🎁Topic/` フィルター、追加・更新・タグ除去・削除・リネームへの差分同期。
- 長大なObsidianノートの書込み失敗対策。保存と全文検索の文字数を制限し、途中失敗は `failed` として次回同期で再試行する。
- ハイブリッド検索改善。FTS、文書embedding、上位候補の本文チャンクembedding、タイトル・タグ・要約の一致を組み合わせて順位付けする。関連度の低いベクトル候補は除外する。
- 任意のAI再ランキング。UIで有効・無効を選択できる。
- 検索結果フィードバック。各結果に「良い・普通・悪い」を設定でき、同一検索語では「良い」を加点し、「悪い」を非表示にする。意味的に近い検索では加点・減点として順位へ反映する。
- タグ候補選択。RaindropとObsidianで実際に使われている明示タグを集約し、ソース別使用数を表示する。
- GitHub Actionsによる本番デプロイと、Raindrop／Obsidian同期ワークフロー。

## Current constraints and open work

- GitHub Webhookの本番Delivery、署名検証、Push後の差分反映をエンドツーエンドで確認する必要がある。
- 悪い評価で非表示にした検索結果を一覧・復元する管理UIは未実装。再検索前は「普通」または「良い」で上書きできる。
- 検索結果に本文チャンクの一致箇所をスニペットとして表示する機能は未実装。
- 別端末からのログイン、検索、同期、管理権限を含む受け入れ確認が必要。
- 本番の最新デプロイ成否はGitHub ActionsとVercelの画面で確認する。

## Important implementation notes

- 本番の秘密値はVercel環境変数にのみ置き、Vaultやこのメモには保存しない。
- `/api/admin/status` をURL直打ちすると、管理Bearer tokenなしでは `Unauthorized` になる。管理画面で `APP_ADMIN_TOKEN` を入力して使う。
- `APP_ACCESS_TOKEN` と `APP_ADMIN_TOKEN` は別の役割を持つ。
- 同期ワークフローは同時実行せず、Raindrop用とObsidian用を順番に実行する。

## Comparison evidence

- 保存前に `memory/` 内で `raindrop`、`obsidian`、`searcher`、`semantic search` を検索し、同プロジェクトの既存メモがないことを確認した。

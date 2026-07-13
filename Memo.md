実運用では、「開始時に読む」「作業中に参照する」「終了時に候補化する」「人間が承認する」「Gitへ記録する」の5段階を基本サイクルにします。

## 0. 初回セットアップ

まずビルドとVault検証を行います。

```sh
npm install
npm run build
npm run validate-vault
```

Codexの`~/.codex/config.toml`または信頼済みリポジトリの`.codex/config.toml`へ、[README.md](/Users/isikurahiromitu/Documents/AI_Memory_DB/README.md)のMCP設定を追加します。

設定後、Codexを再起動し、次のように確認します。

> `memory_read_index`を実行して、現在のMemory Vaultの状態を教えて。

## 1. 最初に登録する情報

現状はプロフィールなどが空なので、まず次の4種類を候補として登録します。

1. 回答・作業方法の好み
2. 現在のプロジェクト
3. 現在の目標
4. 確定済みの思想・判断原則

最初から大量に登録せず、AIの挙動へ明確に影響するものだけに絞ります。

依頼例：

> 私への回答では、結論を先に示し、その後に根拠を説明してください。この内容をPreference候補として作成してください。正式領域は変更しないでください。

作成された候補は`_staging/`に置かれます。

思想の場合：

> 「データの所有権と可搬性を重視する」を思想候補として作成してください。根拠はこの会話を参照し、high-riskとして扱ってください。

## 2. 毎回のセッション開始

### 一般的な作業

次のように始めます。

> `MEMORY.md`を読み、今回の依頼に必要な記憶だけ取得してください。全Vaultは読まないでください。

### プロジェクトを再開する場合

> `project-resume`目的で`ai-memory-system`のコンテキストを構築し、現在地、完了済み、次の作業、ブロッカーを説明してください。

想定される取得順序は次のとおりです。

1. `MEMORY.md`
2. 対象プロジェクトの`STATE.md`
3. 関連するpinned思想
4. 最近のDecision
5. 直近のSession
6. `references.md`

### 技術判断の場合

> `technical-decision`目的で関連コンテキストを取得してから判断してください。過去のDecision、Philosophy、Preferenceを優先してください。

### 文書作成の場合

> `writing`目的で文体、思想、Identity、関連Knowledgeを取得してから執筆してください。

## 3. 作業中の情報参照

過去の情報を使わせたい場合は、単に「覚えている？」ではなく、検索対象を明示します。

### 過去の判断

> `decision_search`でMCP採用に関する過去の判断を検索してください。

### 技術的な学び

> `memory_search`でMarkdown検索とインデックスに関するKnowledgeを検索してください。

### 思想・価値観

> `philosophy_search`でデータ所有権と可搬性に関する承認済み思想を検索してください。

### 個別ファイル

> IDまたはパスを指定して`memory_get`で取得してください。

検索結果に出典、状態、更新日があるかも確認させます。

> 回答に使った記憶について、パス、status、updatedAt、sourceを示してください。

## 4. 外部情報の取り扱い

### Obsidian

Obsidianは読み取り専用です。

> Obsidianから「AI Memory」に関するノートを検索してください。まだMemory Vaultへコピーしないでください。

長期的に参照したいものだけ候補化します。

> このObsidianノートの全文ではなく、要約と元ノートへの参照をStaging候補として作ってください。

### Raindrop

現在はMock Adapterなので、実際のRaindrop Searcher接続後に利用します。

接続後の流れは次のとおりです。

> Raindropからlocal-firstに関するブックマークを検索してください。

続けて：

> このブックマークの要約、URL、Bookmark ID、Collection、タグを参照候補として作ってください。

外部情報を無条件に正式Knowledgeへ昇格しないことが重要です。

## 5. 作業中に生じた情報の取り込み

会話ログや一時メモは、最初にInboxへ入れます。

> この作業ログを`inbox_add`で保存してください。これはまだ正式な記憶ではありません。

Inboxへ入れる例：

- Codexセッションログ
- 手動メモ
- 調査結果
- 外部連携で取得した素材
- 未整理のアイデア

一時的な情報をすべて長期記憶へ変換する必要はありません。

## 6. セッション終了時

終了時には、次の指示を定型化すると運用しやすくなります。

> 今日のセッションを終了します。以下を実施してください。
>
> 1. 依頼内容、実施内容、完了事項、判断、ブロッカー、次回の再開位置を整理する
> 2. Session記憶候補を作る
> 3. 必要ならSTATE.md更新候補を作る
> 4. 再利用可能なKnowledgeまたはDecision候補があれば分けて作る
> 5. 一時的な情報は長期記憶候補にしない
> 6. すべて`_staging/`へ保存し、正式領域は変更しない

候補は目的別に分離します。

- 現在地の変更 → `project-state`
- 過去に行った判断 → `decision`
- 作業履歴 → `session`
- 他でも使える学び → `knowledge`
- 個人の好み → `preference`
- 判断原則 → `philosophy`

一つの巨大な候補ファイルへまとめないようにします。

## 7. Stagingレビュー

セッション終了後、または週に数回まとめて確認します。

### 候補一覧

> `staging_list`で承認待ち候補を、種類、対象パス、riskLevel、proposedAction、source付きで一覧表示してください。

### 差分確認

> この候補について`staging_diff`を実行し、既存内容から意味が変わる箇所を説明してください。

確認項目：

- 出典が正しいか
- 一時情報ではないか
- 既存記憶と重複していないか
- 矛盾していないか
- summaryだけで内容を判断できるか
- `updatedAt`が正しいか
- targetPathが適切か
- high-risk指定が適切か
- 秘密情報や不要な個人情報がないか

## 8. 承認・却下

### 通常の承認

> この候補を承認してください。

### high-riskの承認

Profile、Preference、Philosophy、Decision変更などは追加確認が必要です。

> 差分を確認しました。このhigh-risk変更を明示的に承認します。`acknowledgeHighRisk: true`で承認してください。

承認すると以下が行われます。

- Frontmatter検証
- 更新前バックアップ
- 原子的更新
- 操作記録
- 候補の`_archive/approved/`への移動
- インデックス再構築
- `MEMORY.md`更新
- Git形式のdiff返却

### 却下

> この候補は一時的な情報なので却下してください。理由は「長期利用しないため」です。

候補は削除されず、`_archive/rejected/`へ移動します。

## 9. Gitで履歴を確定

承認後は、まず状態を確認します。

```sh
git status
git diff
npm run validate-vault
npm run check
```

問題なければ人間がコミットします。

```sh
git add .
git commit -m "Add approved memory updates"
```

推奨コミット単位は次のいずれかです。

- 一回のStagingレビュー
- 一日の作業終了
- 一つの重要Decision
- 一つのProject State更新

秘密情報が含まれていないか、コミット前に必ず確認します。

## 10. 定期メンテナンス

### 毎週

- Stagingの未処理候補を確認
- active記憶の重複を確認
- Project Stateが現状と一致するか確認
- 終了したGoalやProjectをアーカイブ
- pinnedが増えすぎていないか確認

依頼例：

> Vaultを週次レビューしてください。変更は行わず、未処理候補、古いactive記憶、期限切れ、重複、矛盾、pinned過多を報告してください。

### 毎月またはプロジェクト節目

- Philosophyの再検討
- Preferenceの実態とのずれを確認
- deprecated/superseded候補を確認
- 完了プロジェクトをアーカイブ
- Knowledgeの有効性と出典を確認

### 検証コマンド

```sh
npm run validate-vault
npm run rebuild-index
npm run check
```

## 推奨する一日の定型フロー

開始：

> Memory Vaultから今回必要なコンテキストだけ取得し、現在地を説明してください。

作業：

> 過去のDecision、Philosophy、Knowledgeを検索してから提案してください。

終了：

> Session要約、STATE更新、Decision、再利用可能なKnowledgeを分離してStaging候補にしてください。

レビュー：

> 候補一覧と差分を表示してください。まだ承認しないでください。

承認：

> 確認済みの候補だけ承認してください。

記録：

```sh
npm run validate-vault
git diff
git add .
git commit -m "Update AI memory vault"
```

この運用を守ると、Vaultは単なる会話ログ置き場ではなく、「現在地・根拠・承認状態が明確なAI向けコンテキスト」として育っていきます。

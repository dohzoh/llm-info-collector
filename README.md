# GitHub Release RSS Collector

Cloudflare Workers 上で動く GitHub リポジトリのリリース情報を自動収集し、JSON API で提供するツール。

## 機能

- **自動収集**: Workers Cron Trigger により1時間ごとに GitHub Atom フィードをフェッチ
- **JSON API**: リリース一覧を REST API で取得可能
- **KV ストレージ**: Cloudflare KV にリリースを保存、重複排除
- **パブリック対応**: 認証不要のパブリックリポジトリに対応

## 技術スタック

| 要素 | 選択 |
|------|------|
| ランタイム | Cloudflare Workers (TypeScript) |
| ストレージ | Cloudflare KV |
| スケジュール | Workers Cron Triggers (`0 * * * *`) |
| XML パース | 組み込み `DOMParser` |

## クイックスタート

### 1. 依存関係インストール

```bash
npm install
```

### 2. Cloudflare KV Namespace 作成

```bash
wrangler kv:namespace create RELEASES
```

出力された `id` を `wrangler.toml` の `id` に設定:

```toml
[[kv_namespaces]]
binding = "RELEASES"
id = "your-actual-namespace-id"
```

### 3. ローカル開発

```bash
npm run dev
```

### 4. デプロイ

```bash
npm run deploy
```

### 5. リポジトリ登録

```bash
curl -X POST https://your-worker.workers.dev/admin/repos \
  -H "Content-Type: application/json" \
  -d '{"repo": "vercel/next.js"}'
```

## API リファレンス

### ヘルスチェック

```
GET /
```

```json
{
  "status": "ok",
  "timestamp": "2025-10-01T00:00:00.000Z"
}
```

### リリース一覧取得

```
GET /repos/{owner}/{repo}/releases
```

クエリパラメータ:
- `limit` (default: 20, max: 100)
- `since` — ISO 8601 形式の日時。この日時以降のリリースのみ返す

```json
{
  "repo": "vercel/next.js",
  "releases": [
    {
      "id": "tag:github.com,2008:...",
      "tag": "v15.0.0",
      "name": "Next.js 15.0.0",
      "url": "https://github.com/vercel/next.js/releases/tag/v15.0.0",
      "published": "2025-10-01T00:00:00Z",
      "body": "<h1>Release Notes</h1>..."
    }
  ],
  "total": 3
}
```

### リポジトリ登録

```
POST /admin/repos
Body: { "repo": "owner/repo" }
```

### リポジトリ登録解除

```
DELETE /admin/repos/{owner}/{repo}
```

## テスト

```bash
npm test
```

## ファイル構成

```
src/
├── index.ts     # Worker エントリポイント
├── cron.ts      # Cron 収集ロジック
├── api.ts       # HTTP API ハンドラ
├── github.ts    # GitHub Atom RSS fetch + parse
├── kv.ts        # KV 操作ラッパー
├── types.ts     # 型定義
├── utils.ts     # ヘルパー関数
└── env.d.ts     # Workers グローバル型宣言
test/
├── github.test.ts
└── api.test.ts
```

## KV キー設計

```
releases:{owner}/{repo}:__index__  → newline-separated release IDs
releases:{owner}/{repo}:{id}        → Release JSON
registered_repos                   → ["owner/repo", ...]
```
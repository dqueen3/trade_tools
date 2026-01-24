# PRTimes Signal

PRTimes のRSSを10分ごとに取得し、キーワードフィルタに一致したPRのみをJSONLで保存し、最新のヒット一覧をMarkdownで出力します。

このリポジトリは PRTimes Signal 用のコードと出力データのみを管理します。ローカルの画面キャプチャ用スクリプトや画像資産は管理対象外です。

## セットアップ

1. Node.js v18以上をインストール
2. 依存関係をインストール

```bash
npm install
```

## 実行方法

```bash
npm run start
```

- 起動時に1回取得し、その後は10分おきに自動取得します。
- RSS URL は `src/fetch.ts` の `RSS_URLS` を編集してください。

## 出力ファイル

- `data/pr_raw.jsonl`: フィルタに一致したPRのJSONLログ
- `reports/latest.md`: 最新順のヒット一覧

### JSONLフォーマット

```json
{
  "id": "title+link のハッシュ",
  "title": "タイトル",
  "summary": "概要",
  "publishedAt": "公開日時",
  "source": "PRTimes",
  "matchedKeywords": ["生成AI"],
  "link": "URL"
}
```

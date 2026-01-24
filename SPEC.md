# PRTimes Signal 仕様まとめ

## 目的
- PRTimes RSS を定期取得し、キーワードに合致したPRのみを保存・可視化する。 

## 取得・判定フロー
1. RSS を取得して XML をパースする。
2. タイトル＋本文抜粋を結合してキーワード判定を行う。
3. include に一致かつ exclude に一致しない場合のみ「ヒット」とする。

## 重複排除
- `title` と `link` から生成したハッシュを `id` とする。
- 既に保存済みの `id` は再登録しない。
- 同一実行内でも `id` が重複するレコードは登録しない。

## 保存データ
- JSONL 形式で `data/pr_raw.jsonl` に追記保存する。
- レコードの項目:
  - `id` / `title` / `summary` / `publishedAt` / `source` / `matchedKeywords` / `link`

## レポート
- `reports/latest.md` に最新順でヒット一覧を出力する。

## スケジュール
- 起動時に1回実行し、その後は10分ごとに取得する。

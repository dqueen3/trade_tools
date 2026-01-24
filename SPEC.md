# PRTimes Signal 仕様まとめ

## 目的
- PRTimes RSS を定期取得し、キーワードに合致したPRのみを保存・可視化する。 

## 取得・判定フロー
1. RSS を取得して XML をパースする。（XML らしくないレスポンスはエラー扱い）
2. タイトル＋本文抜粋を結合してキーワード判定を行う。
3. include に一致かつ exclude に一致しない場合のみ「一次ヒット」とする。
4. 一次ヒットに対して GPT 判定を行い、上場企業（または子会社）かつカテゴリ A のみ「最終ヒット」とする。

## 重複排除
- `title` と `link` から生成したハッシュを `id` とする。
- 既に保存済みの `id` は再登録しない。
- 同一実行内でも `id` が重複するレコードは登録しない。

## 保存データ
- JSONL 形式で `data/pr_raw.jsonl` に追記保存する。
- レコードの項目:
  - `id` / `title` / `summary` / `publishedAt` / `source` / `matchedKeywords` / `link`
  - `gptCategory` / `gptReason` / `gptIsListed` / `gptPassed` / `gptCalledAt`

## GPT 判定
- OpenAI Responses API を利用して、上場企業判定とカテゴリ（A〜D）を取得する。
- A 判定かつ `is_listed=true` の場合のみ `gptPassed=true` とする。
- リクエスト/レスポンスは `data/gpt_api.log` に簡易ログを残し、サイズ超過時にローテーションする。

## 拒否レコードの保持
- GPT 判定で `gptPassed=false` のレコードは 30 日保持し、以降は削除する。

## レポート
- `reports/latest.md` に最新順で最終ヒット（`gptPassed=true`）のみ出力する。

## スケジュール
- 起動時に1回実行し、その後は10分ごとに取得する。

# 親のこと、家族のこと。

https://oyatokazoku.com/ の静的サイト。入院・介護・葬儀・相続・遺品整理・実家じまいのガイドと、相談・家族・費用メモ `/tools/` を公開しています。

```sh
npm run build
npm run check
```

- `content/pages.json`: 本文と編集日時。制度の確認日は本文内に個別記載。
- `content/actions.json`: 各ガイドの最初の行動、質問例、行き詰まった場合の対応。
- `content/search-topics.json`: 読者が使う言葉、検索結果の説明、直接開く見出し。本文から生成する検索索引と併用します。
- `scripts/generate.mjs`: 共通ヘッダー・本文・サイトマップ・検索索引を生成。
- `static/site.js`: メモの入力、費用計算、テキスト保存、印刷、文例のコピー。メモの入力値は送信・永続保存しません。
- `static/guide-search.js`: 記事・見出しの検索と結果表示。検索語は端末内で照合します。
- `npm run check`: URL、アンカー、検索結果、ガイドの冒頭案内、費用計算と保存処理を確認。画面と印刷の表示はブラウザで別途確認します。

出力は `dist`。Cloudflare Workers の既存ビルドは `npm run build`、公開コマンドは `npx wrangler deploy`。本番用リポジトリは `born2coder/oyatokazoku-cloudflare`、編集元は `born2coder/oyatokazoku-static` です。公開用リポジトリの main 更新で既存のビルドが開始します。

費用比較は説明用の架空例です。実家の比較・賃貸・解体ページは同じ試算ブロックを掲載し、検証で一致を確認します。金額変更時は3ページを同時に更新してください。

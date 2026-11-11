# ウマ娘 音MAD まとめ

ニコニコ動画と YouTube からウマ娘の音MADを毎日自動で集めて、検索・絞り込み・サイト内再生ができるようにした静的サイトです。

- ニコ動: 「ウマ娘」または「ウマ娘プリティーダービー」と、「音MAD」の両方のタグが付いた動画。加えて、キャラのタグ（`〇〇(ウマ娘)`）と「音MAD」が付いた動画
- YouTube: 再生リスト [ウマ娘 音mad / umamusume otomad](https://www.youtube.com/playlist?list=PLr6e2du4c5xBxBP4WkmVZPRKVAa0qgC8h)

各動画の権利は投稿者に帰属します。

## 手元で動かす

Node.js 22.6 以上が必要です。

```bash
npm install
npm run fetch   # data/videos.json を作り直す（20秒ほどかかる）
npm run dev     # http://localhost:5173 で開く
npm test        # テスト
```

YouTube の動画も取るときは、プロジェクト直下に `.env` を作って API キーを書きます。`.env` は Git に入りません。

```
YOUTUBE_API_KEY=ここにキー
```

キーが無いときは YouTube を飛ばし、前回のデータを残します。

## YouTube API キーの作り方

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作る
2. 「API とサービス」→「ライブラリ」で **YouTube Data API v3** を有効にする
3. 「認証情報」→「認証情報を作成」→「API キー」
4. 作ったキーの「API の制限」で **YouTube Data API v3 だけ**に絞る

1回の取得で使うのは約36ユニットです。無料枠は1日 10,000ユニットです。

## GitHub での公開設定

1. Settings → Secrets and variables → Actions → New repository secret で、`YOUTUBE_API_KEY` にキーを登録する
2. Settings → Pages → Build and deployment の Source を **GitHub Actions** にする
3. Actions タブの「update」を手動実行（Run workflow）すると、取得とビルドと公開が走る

その後は毎日 9時（日本時間）に自動で更新されます。ニコ動の検索データは朝 7時ごろに更新されるので、新しい動画が載るのは投稿の翌朝です。

## 動画を一覧から外す

`exclude.json` に1行足してコミットします。push をきっかけに数分でサイトから消えます。

```json
[
  { "id": "sm12345678", "reason": "ウマ娘と関係ない" },
  { "id": "yt:動画ID" }
]
```

ID はニコ動なら `sm…`、YouTube なら `yt:` + 動画 ID（`watch?v=` の後ろの11文字）です。

### 淫夢系などをタグで外す

`ng-tags.json` の `tags` のどれかが付いていて、ウマ娘のキャラが見当たらない（キャラのタグもタイトルのキャラ名も無い）ニコ動の動画は、自動で外れます。外したくない動画は `keep` に ID を足します。

```json
{ "tags": ["真夏の夜の淫夢", "例のアレ", "レスリングシリーズ"], "keep": ["sm38687063"] }
```

## 連続再生とプレイリスト

- **連続再生**: 視聴ページの「連続再生」をオンにすると、動画が終わったら一覧の中で次の動画を再生します。最初はオフです
- **プレイリスト**: 視聴ページの「＋ 保存」で好きなプレイリストに入れられます。ヘッダーの「プレイリスト」から、作る・名前を変える・並べ替える・削除、順番どおり／シャッフル再生、ループの切り替えができます
- プレイリストは**この端末のブラウザにだけ**保存されます。別の端末へ移すときや人に見せるときは、プレイリストの「共有」でコピーされる URL を使います（開いた人は「自分のプレイリストに保存」できます）
- ブラウザの決まりで、URL から直接視聴ページを開いたときは自動で再生が始まりません。一度プレーヤーの再生ボタンを押してください

## しくみ

- `scripts/` … 取得スクリプト。ニコ動のスナップショット検索 API と YouTube Data API から動画を集め、`data/videos.json` に書き出す。片方の取得に失敗したら、そのサイトのぶんは前回のデータを残す
- `src/` … 1ページのサイト（Vite + TypeScript）。`data/videos.json` を読み込み、ブラウザ内で検索・並べ替えをする
- `.github/workflows/update.yml` … 毎日の取得 → コミット → ビルド → GitHub Pages への公開

設計書は `docs/superpowers/specs/` にあります。

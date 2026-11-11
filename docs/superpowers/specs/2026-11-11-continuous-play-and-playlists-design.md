# 連続再生と自分だけのプレイリスト 設計書

- 作成日: 2026-11-11
- 状態: レビュー待ち
- 元の設計書: `2026-10-24-umamusume-otomad-site-design.md`

## 1. 目的

視聴ページで動画が終わったら次の動画を自動で再生できるようにし、見る人が自分のプレイリストを名前付きでいくつでも作って、順番どおり・シャッフル・ループで連続再生できるようにする。

### 成功の条件

- 連続再生スイッチをオンにすると、動画が終わったら「次に見る」の先頭が自動で始まる（ニコ動・YouTube とも）
- 視聴ページから、動画を好きなプレイリストに入れたり外したりできる
- プレイリストを作る・名前を変える・消す・順番を入れ替える・動画を外す、ができる
- プレイリストを順番どおり・シャッフルで再生でき、ループのオン・オフを切り替えられる
- プレイリストを URL で共有でき、開いた人が自分のプレイリストとして保存できる
- これまでの URL（一覧・視聴・絞り込み・並び順）はそのまま使える

## 2. プレーヤー（`src/watch.ts`）

`showVideo(video: Video, onEnded: () => void): void` に変え、再生が終わったら `onEnded` を呼ぶ。`stopVideo()` はそのまま。

### 2.1 YouTube

- 公式の IFrame Player API（`https://www.youtube.com/iframe_api`）を、最初に YouTube 動画を開いたときに1回だけ読み込む
- `new YT.Player(要素, { host: "https://www.youtube-nocookie.com", videoId, playerVars: { autoplay: 1, playsinline: 1 } })`
- `onStateChange` で `data === 0`（終わった）なら `onEnded`
- YouTube から YouTube に切り替えるときは、プレーヤーを作り直さず `loadVideoById` を使う

### 2.2 ニコ動

- `https://embed.nicovideo.jp/watch/<id>?jsapi=1&playerId=<番号>&autoplay=1` の iframe。`<番号>` は iframe を作るたびに増やす
- `window` の `message` を受け、`origin === "https://embed.nicovideo.jp"` かつ `data.playerId === 今の番号` のものだけ扱う（前の動画のプレーヤーからの知らせを無視する）
- `eventName === "loadComplete"` で再生命令 `{ eventName: "play", sourceConnectorType: 1, playerId }` を送る（URL の autoplay だけでは始まらないことを確認済み）
- `eventName === "playerStatusChange"` かつ `data.playerStatus === 4`（終わった）なら `onEnded`

### 2.3 確認済みのこと（2026-11-11）

- YouTube: 状態 1（再生中）→ 0（終了）を受け取れた
- ニコ動: `playerStatusChange` で 2（再生中）→ 4（終了）を受け取れた。再生命令で再生が始まった

## 3. 連続再生

- 視聴ページに「連続再生」スイッチ（チェックボックス）を置く。最初はオフ
- 状態は `localStorage` のキー `umamad.autoplay`（`"1"` か `"0"`）に保存する。読み書きは try で囲み、使えなくても動くようにする
- 動画が終わったとき
  - プレイリスト再生中: 5.3 のルールで次へ（スイッチに関係なく進む）
  - それ以外でスイッチがオン: 「次に見る」の先頭を開く（カードを押したときと同じく履歴に積む）
  - それ以外: 何もしない

## 4. プレイリストのデータ（`src/playlists.ts`）

### 4.1 形

```ts
type Playlist = {
  id: string;       // "pl-" + ランダムな英数字
  name: string;     // 1〜50文字
  items: string[];  // 動画 ID（Video.id と同じ形）。重複なし
  loop: boolean;
  createdAt: string; // ISO 8601
};
```

- 保存先は `localStorage` のキー `umamad.playlists`（`Playlist[]` の JSON）
- 読み込むとき形が合わない要素は捨てる。読み書きできないときは空の一覧として動く
- 動画 ID だけを持つので、あとで一覧から外れた動画は表示のときに飛ばし、「見つからない動画 N件」と出す

### 4.2 操作（どれも新しい配列を返す純粋な関数）

- `createPlaylist(lists, name, now, id)` … 名前は前後の空白を取り、空なら「新しいプレイリスト」
- `renamePlaylist(lists, id, name)`
- `deletePlaylist(lists, id)`
- `toggleItem(lists, id, videoId)` … 入っていれば外し、無ければ末尾に足す
- `removeItem(lists, id, videoId)`
- `moveItem(lists, id, index, delta)` … `delta` は -1 か +1。端を越える移動は何もしない
- `setLoop(lists, id, loop)`

### 4.3 共有 URL

- `shareSearch(playlist)` → `?pl=<名前>&ids=<ID をカンマ区切り>`
- `parseShare(search)` → `{ name, items } | null`
  - ID は `^(sm|so|nm|ss)\d+$` か `^yt:[A-Za-z0-9_-]{11}$` だけを通す（それ以外は捨てる）
  - 500件までにする
  - `pl` も `ids` も無ければ `null`

## 5. 画面

### 5.1 URL

| URL | 画面 |
|---|---|
| `?view=playlists` | 自分のプレイリスト一覧 |
| `?view=playlist&list=<id>` | プレイリストの中身 |
| `?v=<動画>&list=<id>` | プレイリストを再生中の視聴ページ。シャッフル中は `&shuffle=1` |
| `?pl=<名前>&ids=…` | 共有されたプレイリスト |

- `State` に `view: "" | "playlists" | "playlist"`、`list: string`、`shuffle: boolean` を足す。既定値は URL に書かない
- `pl` と `ids` は `State` に入れず、共有画面を開くときに `parseShare` で読む

### 5.2 プレイリストの画面

- ヘッダーのタイトルの横に「プレイリスト」ボタン → `?view=playlists`
- 一覧: 名前・動画数を並べる。「新しいプレイリスト」で作る（名前の入力欄つき）
- 中身: 名前（その場で書き換えられる）、動画をカードで縦に並べ、各行に ↑・↓・✕ ボタン
  - 「再生」（順番どおり）・「シャッフル再生」・ループのスイッチ・「共有」（共有 URL をコピー）・「削除」（確認してから）
  - 動画が0本のときは「視聴ページの『＋ 保存』から動画を入れられます」と出す
- 共有された画面: 名前と中身を見せ、「自分のプレイリストに保存」で保存して中身の画面へ移る

### 5.3 プレイリスト再生中の視聴ページ

- 右側（スマホでは下）の「次に見る」の代わりに、プレイリストの中身を出す。見出しは「名前 3/10」、再生中の動画に印を付ける
- 再生順
  - 順番どおり: `items` の順
  - シャッフル: 再生を始めたときに `items` をシャッフルした順を作り、そのページを開いている間はその順を使う（読み直したら作り直す）
- 終わったら次へ。最後まで行ったら、ループがオンなら最初に戻り、オフなら止まる
- 順番を決める関数 `nextId(order: string[], currentId: string, loop: boolean): string | null` を `src/playlists.ts` に置く
- 中身の動画を押すと、プレイリストを再生したままその動画に切り替える

### 5.4 「＋ 保存」

- 視聴ページの操作ボタンの並びに置く
- 押すと小さなパネルが開き、プレイリストをチェックボックス付きで並べる。チェックで入れる・外す
- パネルの下に「新しいプレイリスト」の名前入力欄と作成ボタン。作ったプレイリストには今の動画を入れる

## 6. テスト

- `tests/playlists.test.ts`: 4.2 の各操作、4.3 の共有 URL（ID の検査・500件の上限・無いときの `null`）、`nextId`（途中・最後でループあり/なし・見つからない ID）、シャッフルの順（全部の ID を1回ずつ含む）
- `tests/url-state.test.ts`: `view`・`list`・`shuffle` の読み書きと既定値の省略
- Playwright で確認する
  - 4〜7秒の短い動画で、連続再生オンなら次が自動で始まり、オフなら止まる（ニコ動・YouTube 両方）
  - プレイリストの作成・追加・入れ替え・削除・ループ・シャッフル・共有 URL からの保存
  - パソコン幅とスマホ幅で表示が崩れない

## 7. 今回やらないこと

- 一覧のカードから直接プレイリストに入れるボタン（カードが `<button>` なので、作りを大きく変える必要がある）
- 端末をまたいだ自動同期（ログインやサーバーが必要）
- 画面を消しても鳴るバックグラウンド再生（埋め込みプレーヤーの仕組みと利用規約の都合）
- ドラッグでの並べ替え（↑↓ボタンで行う）

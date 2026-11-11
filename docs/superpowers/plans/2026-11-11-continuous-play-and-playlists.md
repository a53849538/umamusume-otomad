# 連続再生と自分だけのプレイリスト 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 視聴ページで動画が終わったら次を自動再生できるようにし、名前付きのプレイリストを作って順番どおり・シャッフル・ループで再生・共有できるようにする。

**Architecture:** プレイリストのデータ操作・共有 URL・再生順は DOM を使わない純粋な関数として `src/playlists.ts` に置き、ブラウザの localStorage への読み書きだけを薄く包む。プレーヤーは YouTube を公式 IFrame Player API に切り替え、ニコ動は埋め込みプレーヤーのメッセージで「終わった」を受ける。メッセージの判定は純粋な関数 `src/embed-events.ts` に分ける。プレイリストの画面は `src/playlist-view.ts` に分け、`main.ts` は URL の状態から画面を選ぶ役に留める。

**Tech Stack:** Vite + TypeScript（UI フレームワークなし）、Vitest、Playwright（確認用）

**Spec:** `docs/superpowers/specs/2026-11-11-continuous-play-and-playlists-design.md`

## Global Constraints

- 実行時の外部ライブラリは足さない。YouTube の IFrame Player API はスクリプト（`https://www.youtube.com/iframe_api`）を実行時に読み込むだけ
- 動画データやプレイリスト名は必ず `textContent` か属性で DOM に入れる。`innerHTML` は使わない
- localStorage のキー: 連続再生 `umamad.autoplay`（`"1"`/`"0"`）、プレイリスト `umamad.playlists`。読み書きは必ず try で囲む
- プレイリスト ID は `"pl-"` + ランダムな英数字。名前は前後の空白を取り、空なら `新しいプレイリスト`、50文字まで
- 共有 URL: `?pl=<名前>&ids=<カンマ区切り>`。通す ID は `^(sm|so|nm|ss)\d+$` か `^yt:[A-Za-z0-9_-]{11}$`、500件まで
- URL: `view`（`playlists`/`playlist`）、`list`、`shuffle=1`。既定値は書かない。これまでの URL はそのまま動く
- ニコ動の埋め込み: `?jsapi=1&playerId=<番号>&autoplay=1`、`loadComplete` で再生命令、`playerStatusChange` の `playerStatus === 4` が終了
- YouTube: `host: "https://www.youtube-nocookie.com"`、`playerVars: { autoplay: 1, playsinline: 1 }`、`onStateChange` の `0` が終了
- 連続再生スイッチは最初はオフ

## Review Focus

1. **localStorage が使えない・中身が壊れている**（プライベートブラウズ、手で書き換えた）→ サイトは普通に動き、プレイリストは空として扱う（Task 1 のテスト `loads an empty list when storage throws or holds broken JSON`）
2. **共有 URL に変な ID や大量の ID が入っている** → 形の合う ID だけ、500件まで（Task 1 のテスト `parseShare keeps only valid ids, up to 500`）
3. **プレイリストに、もう一覧に無い動画が入っている** → 表示と再生順から飛ばし、「見つからない動画 N件」を出す（Task 1 のテスト `nextId moves on from an id that is not in the order` と Task 6 の確認手順）
4. **URL の `list` が存在しない・再生中にそのプレイリストを消した** → 視聴ページは普通の「次に見る」に戻り、`view=playlist` なら「見つかりませんでした」を出す（Task 6・7 の確認手順）
5. **動画をすばやく切り替えたとき、前のニコ動プレーヤーから「終わった」が届く** → 無視する（Task 3 のテスト `ignores messages from another player`）

---

## ファイル構成

- Create: `src/playlists.ts`（データ操作・保存・共有 URL・再生順）、`src/embed-events.ts`（ニコ動メッセージの判定）、`src/playlist-view.ts`（プレイリストの画面と「＋ 保存」パネルの描画）
- Modify: `src/filter.ts`（`State` に3項目）、`src/url-state.ts`、`src/watch.ts`、`src/main.ts`、`index.html`、`src/style.css`、`README.md`
- Test: `tests/playlists.test.ts`、`tests/embed-events.test.ts`、`tests/url-state.test.ts`

---

### Task 1: プレイリストのデータ操作

**Files:**
- Create: `src/playlists.ts`
- Test: `tests/playlists.test.ts`

**Interfaces:**
- Produces:
  - `type Playlist = { id: string; name: string; items: string[]; loop: boolean; createdAt: string }`
  - `newPlaylistId(random?: () => number): string`
  - `createPlaylist(lists: Playlist[], name: string, now: Date, id: string): Playlist[]`（末尾に足す）
  - `renamePlaylist(lists, id, name)`・`deletePlaylist(lists, id)`・`toggleItem(lists, id, videoId)`・`removeItem(lists, id, videoId)`・`moveItem(lists, id, index, delta: -1 | 1)`・`setLoop(lists, id, loop)`（どれも `Playlist[]` を返し、元の配列は変えない）
  - `loadPlaylists(storage?: Pick<Storage, "getItem">): Playlist[]`・`savePlaylists(lists: Playlist[], storage?: Pick<Storage, "setItem">): void`（既定は `localStorage`）
  - `shareSearch(p: { name: string; items: string[] }): string`・`parseShare(search: string): { name: string; items: string[] } | null`
  - `nextId(order: string[], currentId: string, loop: boolean): string | null`
  - `shuffled<T>(items: T[], random?: () => number): T[]`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/playlists.test.ts の主なテスト
it("creates with a trimmed name, or a default when empty", () => {
  const now = new Date("2026-11-11T00:00:00Z");
  const a = createPlaylist([], "  ゴルシ  ", now, "pl-a");
  expect(a).toEqual([{ id: "pl-a", name: "ゴルシ", items: [], loop: false, createdAt: "2026-11-11T00:00:00.000Z" }]);
  expect(createPlaylist([], "   ", now, "pl-b")[0].name).toBe("新しいプレイリスト");
  expect(createPlaylist([], "あ".repeat(60), now, "pl-c")[0].name).toHaveLength(50);
});
it("toggles an item on and off without duplicates", () => { /* 追加→ items ["sm1"]、もう一度→ [] */ });
it("moves items and ignores moves past the ends", () => {
  // items ["a","b","c"]: moveItem(...,"pl",0,1) → ["b","a","c"]、moveItem(...,"pl",0,-1) → 変わらない、moveItem(...,"pl",2,1) → 変わらない
});
it("renames, deletes, removes items and sets loop", () => { /* それぞれ1件ずつ */ });
it("does not change the original array", () => { /* toggleItem の前後で元の配列が同じ */ });
it("loads an empty list when storage throws or holds broken JSON", () => {
  expect(loadPlaylists({ getItem: () => { throw new Error("denied"); } })).toEqual([]);
  expect(loadPlaylists({ getItem: () => "{broken" })).toEqual([]);
  // 形の合わない要素だけ捨てる
  expect(loadPlaylists({ getItem: () => JSON.stringify([{ id: "pl-a", name: "x", items: ["sm1"], loop: false, createdAt: "" }, { id: 1 }]) })).toHaveLength(1);
});
it("does not throw when saving fails", () => {
  expect(() => savePlaylists([], { setItem: () => { throw new Error("quota"); } })).not.toThrow();
});
it("round-trips a share url", () => {
  expect(parseShare(shareSearch({ name: "ゴルシ音MAD", items: ["sm1", "yt:abcdefghijk"] }))).toEqual({ name: "ゴルシ音MAD", items: ["sm1", "yt:abcdefghijk"] });
});
it("parseShare keeps only valid ids, up to 500", () => {
  expect(parseShare("?pl=x&ids=sm1,<script>,yt:short,so2")?.items).toEqual(["sm1", "so2"]);
  const many = Array.from({ length: 600 }, (_, i) => `sm${i}`).join(",");
  expect(parseShare(`?pl=x&ids=${many}`)?.items).toHaveLength(500);
  expect(parseShare("?q=abc")).toBeNull();
});
it("nextId walks the order and loops only when asked", () => {
  expect(nextId(["a", "b", "c"], "a", false)).toBe("b");
  expect(nextId(["a", "b", "c"], "c", false)).toBeNull();
  expect(nextId(["a", "b", "c"], "c", true)).toBe("a");
});
it("nextId moves on from an id that is not in the order", () => {
  expect(nextId(["a", "b"], "zzz", false)).toBe("a");
  expect(nextId([], "a", true)).toBeNull();
});
it("shuffled contains every item exactly once", () => {
  const out = shuffled(["a", "b", "c", "d"], () => 0.3);
  expect([...out].sort()).toEqual(["a", "b", "c", "d"]);
});
```

- [ ] **Step 2: 失敗を確認する** — Run: `npx vitest run tests/playlists.test.ts` / Expected: FAIL（モジュールが無い）
- [ ] **Step 3: `src/playlists.ts` を実装する**（シャッフルは Fisher–Yates。共有 URL は `URLSearchParams` で作る・読む）
- [ ] **Step 4: 成功を確認する** — Run: `npx vitest run tests/playlists.test.ts` / Expected: PASS
- [ ] **Step 5: コミット** — `feat: プレイリストのデータ操作・保存・共有 URL・再生順`

---

### Task 2: URL の状態に view・list・shuffle を足す

**Files:**
- Modify: `src/filter.ts`（`State` と `DEFAULT_STATE`）、`src/url-state.ts`
- Test: `tests/url-state.test.ts`

**Interfaces:**
- Produces: `State` に `view: "" | "playlists" | "playlist"`、`list: string`、`shuffle: boolean`。既定値は `""`・`""`・`false`

- [ ] **Step 1: 失敗するテストを書く**

```ts
it("round-trips playlist params", () => {
  const s = { ...DEFAULT_STATE, v: "sm1", list: "pl-a", shuffle: true };
  expect(parseState(stringifyState(s))).toEqual(s);
  expect(stringifyState({ ...DEFAULT_STATE, view: "playlists" })).toBe("?view=playlists");
});
it("ignores unknown view and treats only shuffle=1 as true", () => {
  expect(parseState("?view=hack").view).toBe("");
  expect(parseState("?shuffle=yes").shuffle).toBe(false);
});
```

- [ ] **Step 2: 失敗を確認する** — Run: `npx vitest run tests/url-state.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装する**（`shuffle` は `true` のときだけ `shuffle=1` を書く。URL の並びは `view, list, v, shuffle, q, src, sort, order, chara, author`）
- [ ] **Step 4: 成功を確認する** — Run: `npm test` / Expected: すべて PASS
- [ ] **Step 5: コミット** — `feat: URL の状態にプレイリストの項目を足す`

---

### Task 3: 「再生が終わった」を受け取るプレーヤー

**Files:**
- Create: `src/embed-events.ts`
- Modify: `src/watch.ts`
- Test: `tests/embed-events.test.ts`

**Interfaces:**
- Produces:
  - `nicoEvent(origin: string, data: unknown, playerId: string): "loaded" | "ended" | null`（`src/embed-events.ts`）
  - `showVideo(video: Video, onEnded: () => void): void`・`stopVideo(): void`（`src/watch.ts`。同じ動画のまま呼ばれたらプレーヤーを作り直さない、は今のまま）

- [ ] **Step 1: 失敗するテストを書く**

```ts
const NICO = "https://embed.nicovideo.jp";
it("detects load and end from the current nico player", () => {
  expect(nicoEvent(NICO, { eventName: "loadComplete", playerId: "3" }, "3")).toBe("loaded");
  expect(nicoEvent(NICO, { eventName: "playerStatusChange", playerId: "3", data: { playerStatus: 4 } }, "3")).toBe("ended");
  expect(nicoEvent(NICO, { eventName: "playerStatusChange", playerId: "3", data: { playerStatus: 2 } }, "3")).toBeNull();
});
it("ignores messages from another player", () => {
  expect(nicoEvent(NICO, { eventName: "playerStatusChange", playerId: "2", data: { playerStatus: 4 } }, "3")).toBeNull();
});
it("ignores other origins and odd data", () => {
  expect(nicoEvent("https://evil.example", { eventName: "loadComplete", playerId: "3" }, "3")).toBeNull();
  expect(nicoEvent(NICO, "text", "3")).toBeNull();
  expect(nicoEvent(NICO, null, "3")).toBeNull();
});
```

- [ ] **Step 2: 失敗を確認する** — Run: `npx vitest run tests/embed-events.test.ts` / Expected: FAIL
- [ ] **Step 3: `nicoEvent` を実装し、`watch.ts` を作り直す**
  - ニコ動: iframe を作るたびに `playerId` を増やす。`window` の `message` を1回だけ登録し、`nicoEvent` が `loaded` なら `{ eventName: "play", sourceConnectorType: 1, playerId }` を `https://embed.nicovideo.jp` に送り、`ended` なら今の `onEnded` を呼ぶ
  - YouTube: API スクリプトを1回だけ読み込む Promise を作り、`new YT.Player(...)` を `#watch-frame` の中の div に作る。YouTube→YouTube は `loadVideoById`。`onStateChange` の `0` で `onEnded`
  - 取得元が変わる・`stopVideo` のときはプレーヤーを消す（YouTube は `destroy()`）
  - `YT` の型は使う分だけ `src/vite-env.d.ts` に宣言する
- [ ] **Step 4: 成功を確認する** — Run: `npm test && npm run build` / Expected: PASS・ビルド成功
- [ ] **Step 5: Playwright で確認する**（`npm run dev`）: `?v=sm44563106`（4秒）と YouTube の一番短い動画（7秒）を開き、ページを一度クリックしてから再生され、終わったときに `onEnded` が呼ばれる（一時的に `console.log` を仕込んで確かめ、確認後に消す）
- [ ] **Step 6: コミット** — `feat: 埋め込みプレーヤーから再生終了を受け取る`

---

### Task 4: 連続再生スイッチ

**Files:**
- Modify: `index.html`（視聴ページの操作ボタンの並びに `<label class="switch"><input id="autoplay" type="checkbox"> 連続再生</label>`）、`src/main.ts`、`src/style.css`

**Interfaces:**
- Consumes: `showVideo(video, onEnded)`（Task 3）、`upNext`（既存）

- [ ] **Step 1: `main.ts` に連続再生をつなぐ**
  - スイッチの初期値は `localStorage["umamad.autoplay"] === "1"`。変えたら保存（try で囲む）
  - `onEnded`（プレイリスト再生中でないとき）: スイッチがオンなら、今の「次に見る」の先頭を `open()` する
- [ ] **Step 2: 確認する** — Run: `npm test && npm run build` / Expected: PASS
- [ ] **Step 3: Playwright で確認する**: 4秒のニコ動を「次に見る」の先頭の手前に来るよう `?v=sm44563106&sort=duration&order=asc` で開く
  - スイッチがオン → 終わると URL の `v` が次の動画に変わる
  - オフ → 変わらない
  - 読み直してもスイッチの状態が残る
- [ ] **Step 4: コミット** — `feat: 連続再生スイッチ`

---

### Task 5: プレイリストの画面（一覧・中身・共有）

**Files:**
- Create: `src/playlist-view.ts`
- Modify: `index.html`（ヘッダーに `<a id="playlists-link" href="?view=playlists">プレイリスト</a>`、`main` に `<section id="playlists" hidden>`）、`src/main.ts`、`src/style.css`

**Interfaces:**
- Consumes: Task 1 のすべて、`renderCards`（既存）
- Produces（`src/playlist-view.ts`。どれも `container` の中身を描き直す）:
  - `renderPlaylistIndex(container: HTMLElement, lists: Playlist[], h: { onOpen(id: string): void; onCreate(name: string): void }): void`
  - `renderPlaylistDetail(container: HTMLElement, p: Playlist, videos: Video[], missing: number, h: { onPlay(shuffle: boolean): void; onOpenVideo(v: Video): void; onMove(index: number, delta: -1 | 1): void; onRemove(videoId: string): void; onRename(name: string): void; onDelete(): void; onLoop(loop: boolean): void; onShare(): void }): void`
  - `renderShared(container: HTMLElement, name: string, videos: Video[], missing: number, onSave: () => void): void`
  - `renderNotFound(container: HTMLElement): void`

- [ ] **Step 1: `playlist-view.ts` を作る**（↑↓✕ は各行のボタン。削除は `confirm()` で確かめる。名前は `<input>` で、`change` で `onRename`）
- [ ] **Step 2: `main.ts` で画面を選ぶ**
  - `?pl=…&ids=…` があれば共有画面。「自分のプレイリストに保存」で `createPlaylist` して `?view=playlist&list=<新しいID>` へ
  - `view === "playlists"` → 一覧、`view === "playlist"` → 中身（`list` が無ければ `renderNotFound`）
  - 中身の動画は `byId` で引き、無いものは `missing` に数える
  - 「再生」は `update({ view: "", v: 先頭, list, shuffle })`、「共有」は `navigator.clipboard.writeText(location.origin + location.pathname + shareSearch(p))`、失敗したら `prompt()` で URL を見せる
  - 変更のたびに `savePlaylists` して描き直す
- [ ] **Step 3: 確認する** — Run: `npm test && npm run build` / Expected: PASS
- [ ] **Step 4: Playwright で確認する**: 作る→名前を変える→（Task 6 の後に入れる動画は localStorage に直接入れて代用）↑↓✕→ループ→共有 URL を新しいタブで開いて保存→削除→`?view=playlist&list=pl-none` で「見つかりませんでした」
- [ ] **Step 5: コミット** — `feat: プレイリストの一覧・中身・共有の画面`

---

### Task 6: 視聴ページの「＋ 保存」

**Files:**
- Modify: `index.html`（視聴ページの操作ボタンの並びに `<button id="watch-save">＋ 保存</button>` と `<div id="save-panel" hidden>`）、`src/playlist-view.ts`、`src/main.ts`、`src/style.css`

**Interfaces:**
- Produces: `renderSavePanel(container: HTMLElement, lists: Playlist[], videoId: string, h: { onToggle(id: string): void; onCreate(name: string): void }): void`

- [ ] **Step 1: パネルを作る**（チェックボックスでプレイリストを並べる。下に名前入力と「作成」。作ったプレイリストには今の動画を入れる。パネルの外を押すか Esc で閉じる）
- [ ] **Step 2: 確認する** — Run: `npm test && npm run build` / Expected: PASS
- [ ] **Step 3: Playwright で確認する**: パネルから新しいプレイリストを作る→チェックを外す・付ける→プレイリストの中身に反映される。一覧に無い ID を localStorage で混ぜ、中身の画面に「見つからない動画 1件」が出る
- [ ] **Step 4: コミット** — `feat: 視聴ページからプレイリストに保存`

---

### Task 7: プレイリストを再生する

**Files:**
- Modify: `index.html`（`.watch-side` の中にプレイリスト用の見出しと一覧 `#playlist-side`）、`src/main.ts`、`src/style.css`

**Interfaces:**
- Consumes: `nextId`・`shuffled`（Task 1）、`showVideo(video, onEnded)`（Task 3）

- [ ] **Step 1: 再生中の表示と次への進み方をつなぐ**
  - `state.v` と `state.list` があり、そのプレイリストが見つかれば再生中とする。見つからなければ普通の「次に見る」を出す
  - 再生順 `order`: 一覧にある動画だけ。`shuffle` なら、プレイリスト ID ごとに一度だけ `shuffled` した順をメモリに持つ（読み直したら作り直す）
  - 横の一覧は `order` の順で出し、見出しは「名前 3/10」、再生中のカードに `is-current` を付ける
  - `onEnded`: `nextId(order, state.v, playlist.loop)` が `null` でなければ `update({ v: 次 })`（`list`・`shuffle` は残す）
  - 横の一覧の動画を押すと `update({ v })`
- [ ] **Step 2: 確認する** — Run: `npm test && npm run build` / Expected: PASS
- [ ] **Step 3: Playwright で確認する**: 短い動画3本（`sm44563106`・`sm46392506`・`sm44103080`）のプレイリストを localStorage に作る
  - 順番どおり: 終わるたびに次へ進み、最後で止まる
  - ループ: 最後のあと最初に戻る
  - シャッフル: 3本とも1回ずつ再生される
  - 再生中にそのプレイリストを消して読み直すと、普通の「次に見る」になる
  - パソコン幅・スマホ幅で横の一覧の表示が崩れない
- [ ] **Step 4: コミット** — `feat: プレイリストの連続・シャッフル・ループ再生`

---

### Task 8: 仕上げと公開

**Files:**
- Modify: `README.md`（「プレイリストと連続再生」の節: 保存はその端末のブラウザだけ、移すときは「共有」の URL を使う）

- [ ] **Step 1: README を書き足す**
- [ ] **Step 2: 全体を確認する** — Run: `npm test && npm run build && grep -n "innerHTML" src/*.ts` / Expected: テスト・ビルド成功、`innerHTML` は無し
- [ ] **Step 3: コミットして push** — `docs: プレイリストと連続再生の説明`
- [ ] **Step 4: 公開後の確認**: 自動更新の成功を確かめ、公開中のサイトで連続再生とプレイリストの再生を1回ずつ試す

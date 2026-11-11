import "./style.css";
import videosJson from "../data/videos.json";
import { DEFAULT_STATE, authorCounts, characterCounts, filterVideos, indexVideos, upNext, type State } from "./filter.ts";
import { formatDate } from "./format.ts";
import { createCombo } from "./combo.ts";
import { renderCards } from "./render.ts";
import type { Video, VideosFile } from "./types.ts";
import { parseState, stringifyState } from "./url-state.ts";
import { showVideo, stopVideo } from "./watch.ts";

const PAGE_SIZE = 60;
const UP_NEXT_SIZE = 30;
const SEARCH_DELAY_MS = 150;

const file = videosJson as VideosFile;
const items = indexVideos(file.videos);
const byId = new Map(file.videos.map((v) => [v.id, v]));

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const qInput = $<HTMLInputElement>("q");
const charaInput = $<HTMLInputElement>("chara");
const authorInput = $<HTMLInputElement>("author");
const srcSelect = $<HTMLSelectElement>("src");
const sortSelect = $<HTMLSelectElement>("sort");
const orderButton = $<HTMLButtonElement>("order");
const browse = $<HTMLElement>("browse");
const watch = $<HTMLElement>("watch");
const watchAuthor = $<HTMLButtonElement>("watch-author");

// 一覧と「次に見る」の両方で使う、少しずつ表示するリスト
function pager(container: HTMLElement, more: HTMLButtonElement, empty: HTMLElement, size: number) {
  let list: Video[] = [];
  let shown = 0;
  const showMore = () => {
    renderCards(container, list.slice(shown, shown + size), open);
    shown = Math.min(shown + size, list.length);
    more.hidden = shown >= list.length;
  };
  more.addEventListener("click", showMore);
  // keep が true なら、「もっと見る」で増やしたぶんまで出し直す
  return (next: Video[], keep = false) => {
    const target = keep ? shown : 0;
    list = next;
    shown = 0;
    container.replaceChildren();
    do showMore();
    while (shown < target && shown < list.length);
    empty.hidden = list.length > 0;
  };
}

const showGrid = pager($("grid"), $("more"), $("empty"), PAGE_SIZE);
const showUpNext = pager($("watch-list"), $("watch-more"), $("watch-empty"), UP_NEXT_SIZE);

let state: State = parseState(location.search);

// 動画を開いて戻ってきたとき、一覧や「次に見る」をスクロールした位置のまま残すための記録。
// 戻る・進むでもこちらで位置を戻すので、ブラウザの自動の位置戻しは切る
history.scrollRestoration = "manual";
const watchSide = document.querySelector(".watch-side") as HTMLElement;
let wasWatching = false;
let browseScrollY = 0;
let gridKey: string | null = null; // 今の一覧を作ったときの絞り込み（v 以外）
let upNextKey: string | null = null;

function render() {
  const results = filterVideos(items, state);
  const current = state.v ? byId.get(state.v) : undefined;
  const key = stringifyState({ ...state, v: "" });
  // 一覧から視聴ページへ移る前に、一覧の位置を覚えておく
  if (current && !wasWatching) browseScrollY = window.scrollY;

  browse.hidden = Boolean(current);
  watch.hidden = !current;
  document.body.classList.toggle("watching", Boolean(current));

  if (current) {
    showVideo(current, () => {}); // 連続再生は Task 4 でつなぐ
    watchAuthor.hidden = !current.author;
    watchAuthor.textContent = current.author ? `${current.author.name} さんの動画を見る` : "";
    const next = upNext(results, current.id);
    $("watch-count").textContent = `${next.length.toLocaleString("ja-JP")}件`;
    // 絞り込みが同じまま動画だけ切り替えたときは、「次に見る」の件数と位置をそのまま残す
    const keep = wasWatching && key === upNextKey;
    const sideTop = watchSide.scrollTop;
    const pageY = window.scrollY;
    showUpNext(next, keep);
    upNextKey = key;
    if (keep) {
      watchSide.scrollTop = sideTop;
      window.scrollTo({ top: pageY });
    } else {
      watchSide.scrollTop = 0;
      if (!wasWatching) window.scrollTo({ top: 0 });
    }
  } else {
    stopVideo();
    $("count").textContent = `${results.length.toLocaleString("ja-JP")}件`;
    if (key !== gridKey) {
      showGrid(results);
      gridKey = key;
      if (wasWatching) window.scrollTo({ top: 0 });
    } else if (wasWatching) {
      // 絞り込みが変わっていなければ一覧は作り直さず、元の位置に戻す
      window.scrollTo({ top: browseScrollY });
    }
  }
  wasWatching = Boolean(current);
}

// 見る動画が変わるとき（と、タイトルでトップに戻るとき）は履歴に積み、ブラウザの「戻る」で戻れるようにする
function update(patch: Partial<State>, options: { push?: boolean } = {}) {
  const before = location.pathname + location.search;
  const push = options.push || (patch.v !== undefined && patch.v !== state.v);
  state = { ...state, ...patch };
  const url = location.pathname + stringifyState(state);
  if (push && url !== before) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
  render();
}

function open(video: Video) {
  update({ v: video.id });
}

const charaCombo = createCombo(charaInput, characterCounts(file.videos), (name) => update({ chara: name }));
const authorCombo = createCombo(authorInput, authorCounts(file.videos), (name) => update({ author: name }));

// 操作バーに状態を反映
function syncInputs() {
  qInput.value = state.q;
  charaCombo.setValue(state.chara);
  authorCombo.setValue(state.author);
  srcSelect.value = state.src;
  sortSelect.value = state.sort;
  // スマホでは文字を隠して矢印だけにする（並び順の選択欄の幅を空けるため）
  const label = document.createElement("span");
  label.className = "order-label";
  label.textContent = state.order === "asc" ? "昇順" : "降順";
  orderButton.replaceChildren(state.order === "asc" ? "↑ " : "↓ ", label);
  orderButton.setAttribute("aria-label", state.order === "asc" ? "昇順で並んでいます。押すと降順にします" : "降順で並んでいます。押すと昇順にします");
}

window.addEventListener("popstate", () => {
  state = parseState(location.search);
  syncInputs();
  render();
});

let searchTimer: ReturnType<typeof setTimeout> | undefined;
qInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => update({ q: qInput.value }), SEARCH_DELAY_MS);
});
srcSelect.addEventListener("change", () => update({ src: srcSelect.value as State["src"] }));
sortSelect.addEventListener("change", () => update({ sort: sortSelect.value as State["sort"] }));
// 降順（新しい順・多い順・長い順）と昇順を切り替える
orderButton.addEventListener("click", () => {
  update({ order: state.order === "asc" ? "desc" : "asc" });
  syncInputs();
});

// 再生は続けたまま、「次に見る」をこの投稿者の動画にする
watchAuthor.addEventListener("click", () => {
  const name = state.v ? byId.get(state.v)?.author?.name : undefined;
  if (!name) return;
  authorCombo.setValue(name);
  update({ author: name });
});
$("watch-back").addEventListener("click", () => update({ v: "" }));

// タイトルを押すと、絞り込みも外した最初の一覧に戻る。Ctrl などを押しながらなら普通のリンクとして新しいタブで開く
$<HTMLAnchorElement>("home").addEventListener("click", (e) => {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  update({ ...DEFAULT_STATE }, { push: true });
  syncInputs();
  window.scrollTo({ top: 0 });
});

// 視聴ページの「次に見る」をヘッダーのすぐ下に固定するため、ヘッダーの高さを CSS に渡す
const bar = document.querySelector<HTMLElement>(".bar");
if (bar) {
  new ResizeObserver(() => document.documentElement.style.setProperty("--bar-h", `${bar.offsetHeight}px`)).observe(bar);
}

$<HTMLElement>("updated").textContent = `最終更新 ${formatDate(file.generatedAt)}`;
if (__REPO_URL__) {
  const issues = $<HTMLAnchorElement>("issues");
  issues.href = `${__REPO_URL__}/issues`;
  issues.hidden = false;
}

syncInputs();
render();

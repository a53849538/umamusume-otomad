import type { Playlist } from "./playlists.ts";
import { renderCards } from "./render.ts";
import type { Video } from "./types.ts";

// プレイリストの画面。名前や動画データは必ず textContent か属性で入れる

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, className: string, onClick: () => void, label?: string): HTMLButtonElement {
  const b = el("button", className, text);
  b.type = "button";
  if (label) b.setAttribute("aria-label", label);
  b.addEventListener("click", onClick);
  return b;
}

function missingNote(missing: number): HTMLElement | null {
  return missing > 0 ? el("p", "pl-note", `見つからない動画 ${missing}件（一覧から外れた動画です）`) : null;
}

// 名前の入力欄と作成ボタン。Enter でも作れる
function createForm(onCreate: (name: string) => void, buttonText = "作成"): HTMLFormElement {
  const form = el("form", "pl-create");
  const input = el("input");
  input.placeholder = "新しいプレイリストの名前";
  input.maxLength = 50;
  input.setAttribute("aria-label", "新しいプレイリストの名前");
  const submit = el("button", "btn-accent", buttonText);
  submit.type = "submit";
  form.append(input, submit);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    onCreate(input.value);
    input.value = "";
  });
  return form;
}

export function renderPlaylistIndex(
  container: HTMLElement,
  lists: Playlist[],
  h: { onOpen(id: string): void; onCreate(name: string): void },
): void {
  const items = lists.map((p) => {
    const row = button("", "pl-item", () => h.onOpen(p.id));
    row.append(el("span", "pl-item-name", p.name), el("span", "pl-item-count", `${p.items.length}本`));
    return row;
  });
  container.replaceChildren(
    el("h2", "pl-title", "プレイリスト"),
    el("p", "pl-note", "プレイリストはこの端末のブラウザに保存されます。別の端末へは、プレイリストの「共有」の URL で移せます。"),
    createForm(h.onCreate),
    ...(items.length ? [el("div", "pl-items")] : [el("p", "empty", "まだプレイリストがありません")]),
  );
  container.querySelector(".pl-items")?.append(...items);
}

export function renderPlaylistDetail(
  container: HTMLElement,
  p: Playlist,
  videos: Video[],
  missing: number,
  h: {
    onPlay(shuffle: boolean): void;
    onOpenVideo(v: Video): void;
    onMove(index: number, delta: -1 | 1): void;
    onRemove(videoId: string): void;
    onRename(name: string): void;
    onDelete(): void;
    onLoop(loop: boolean): void;
    onShare(): void;
    onBack(): void;
  },
): void {
  const name = el("input", "pl-name");
  name.value = p.name;
  name.maxLength = 50;
  name.setAttribute("aria-label", "プレイリストの名前");
  name.addEventListener("change", () => h.onRename(name.value));

  const loop = el("label", "switch");
  const loopInput = el("input");
  loopInput.type = "checkbox";
  loopInput.checked = p.loop;
  loopInput.addEventListener("change", () => h.onLoop(loopInput.checked));
  loop.append(loopInput, " ループ");

  const actions = el("div", "pl-actions");
  const play = button("▶ 再生", "btn-accent", () => h.onPlay(false));
  const shuffle = button("🔀 シャッフル再生", "btn-ghost", () => h.onPlay(true));
  play.disabled = shuffle.disabled = videos.length === 0;
  actions.append(
    play,
    shuffle,
    loop,
    button("共有", "btn-ghost", h.onShare),
    button("削除", "btn-ghost pl-delete", () => {
      if (confirm(`「${p.name}」を削除しますか？`)) h.onDelete();
    }),
  );

  const list = el("div", "watch-list pl-videos");
  videos.forEach((v, i) => {
    const row = el("div", "pl-row");
    renderCards(row, [v], h.onOpenVideo);
    const controls = el("div", "pl-row-controls");
    const up = button("↑", "pl-icon", () => h.onMove(i, -1), "上へ");
    const down = button("↓", "pl-icon", () => h.onMove(i, 1), "下へ");
    up.disabled = i === 0;
    down.disabled = i === videos.length - 1;
    controls.append(up, down, button("✕", "pl-icon", () => h.onRemove(v.id), "プレイリストから外す"));
    row.append(controls);
    list.append(row);
  });

  container.replaceChildren(
    button("← プレイリスト一覧", "btn-ghost pl-back", h.onBack),
    name,
    el("p", "count", `${videos.length}本`),
    actions,
    ...[missingNote(missing)].filter((n): n is HTMLElement => n !== null),
    videos.length ? list : el("p", "empty", "視聴ページの「＋ 保存」から動画を入れられます"),
  );
}

export function renderShared(
  container: HTMLElement,
  name: string,
  videos: Video[],
  missing: number,
  onSave: () => void,
  onOpenVideo: (v: Video) => void,
): void {
  const list = el("div", "watch-list pl-videos");
  renderCards(list, videos, onOpenVideo);
  container.replaceChildren(
    el("p", "pl-note", "共有されたプレイリスト"),
    el("h2", "pl-title", name),
    el("p", "count", `${videos.length}本`),
    el("div", "pl-actions"),
    ...[missingNote(missing)].filter((n): n is HTMLElement => n !== null),
    list,
  );
  container.querySelector(".pl-actions")?.append(button("自分のプレイリストに保存", "btn-accent", onSave));
}

export function renderNotFound(container: HTMLElement, onBack: () => void): void {
  container.replaceChildren(
    button("← プレイリスト一覧", "btn-ghost pl-back", onBack),
    el("p", "empty", "プレイリストが見つかりませんでした"),
  );
}

// 視聴ページの「＋ 保存」。チェックで入れる・外す。新しく作ったプレイリストには今の動画を入れる
export function renderSavePanel(
  container: HTMLElement,
  lists: Playlist[],
  videoId: string,
  h: { onToggle(id: string): void; onCreate(name: string): void },
): void {
  const items = lists.map((p) => {
    const label = el("label", "save-item");
    const input = el("input");
    input.type = "checkbox";
    input.checked = p.items.includes(videoId);
    input.addEventListener("change", () => h.onToggle(p.id));
    label.append(input, el("span", "save-item-name", p.name));
    return label;
  });
  container.replaceChildren(
    el("p", "save-title", "プレイリストに保存"),
    ...(items.length ? items : [el("p", "pl-note", "まだプレイリストがありません")]),
    createForm(h.onCreate, "作成して保存"),
  );
}

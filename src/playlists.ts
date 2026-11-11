// 自分だけのプレイリスト。データはその端末のブラウザ（localStorage）にだけ置く。
// 操作はどれも新しい配列を返し、元の配列は変えない

export type Playlist = {
  id: string; // "pl-" + ランダムな英数字
  name: string;
  items: string[]; // 動画 ID（Video.id と同じ形）。重複なし
  loop: boolean;
  createdAt: string;
};

const STORAGE_KEY = "umamad.playlists";
const DEFAULT_NAME = "新しいプレイリスト";
const MAX_NAME_LENGTH = 50;
const MAX_SHARE_ITEMS = 500;
const VIDEO_ID = /^(?:(?:sm|so|nm|ss)\d+|yt:[A-Za-z0-9_-]{11})$/;

function cleanName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_NAME;
}

export function newPlaylistId(random: () => number = Math.random): string {
  return `pl-${Math.floor(random() * 36 ** 8).toString(36).padStart(8, "0")}${Date.now().toString(36)}`;
}

export function createPlaylist(lists: Playlist[], name: string, now: Date, id: string): Playlist[] {
  return [...lists, { id, name: cleanName(name), items: [], loop: false, createdAt: now.toISOString() }];
}

function update(lists: Playlist[], id: string, f: (p: Playlist) => Playlist): Playlist[] {
  return lists.map((p) => (p.id === id ? f(p) : p));
}

export function renamePlaylist(lists: Playlist[], id: string, name: string): Playlist[] {
  return update(lists, id, (p) => ({ ...p, name: cleanName(name) }));
}

export function deletePlaylist(lists: Playlist[], id: string): Playlist[] {
  return lists.filter((p) => p.id !== id);
}

// 入っていれば外し、無ければ末尾に足す
export function toggleItem(lists: Playlist[], id: string, videoId: string): Playlist[] {
  return update(lists, id, (p) => ({
    ...p,
    items: p.items.includes(videoId) ? p.items.filter((v) => v !== videoId) : [...p.items, videoId],
  }));
}

export function removeItem(lists: Playlist[], id: string, videoId: string): Playlist[] {
  return update(lists, id, (p) => ({ ...p, items: p.items.filter((v) => v !== videoId) }));
}

// 端を越える移動は何もしない
export function moveItem(lists: Playlist[], id: string, index: number, delta: -1 | 1): Playlist[] {
  return update(lists, id, (p) => {
    const to = index + delta;
    if (index < 0 || index >= p.items.length || to < 0 || to >= p.items.length) return p;
    const items = [...p.items];
    [items[index], items[to]] = [items[to], items[index]];
    return { ...p, items };
  });
}

// 画面で隣り合う2本を ID で入れ替える。一覧から外れた動画が間に挟まっていても、画面どおりに動く
export function swapItems(lists: Playlist[], id: string, a: string, b: string): Playlist[] {
  return update(lists, id, (p) => {
    const i = p.items.indexOf(a);
    const j = p.items.indexOf(b);
    if (i < 0 || j < 0) return p;
    const items = [...p.items];
    [items[i], items[j]] = [items[j], items[i]];
    return { ...p, items };
  });
}

export function setLoop(lists: Playlist[], id: string, loop: boolean): Playlist[] {
  return update(lists, id, (p) => ({ ...p, loop }));
}

function isPlaylist(x: unknown): x is Playlist {
  const p = x as Playlist;
  return (
    typeof p === "object" && p !== null &&
    typeof p.id === "string" && typeof p.name === "string" && typeof p.createdAt === "string" &&
    typeof p.loop === "boolean" && Array.isArray(p.items) && p.items.every((v) => typeof v === "string")
  );
}

// 読めない・壊れているときは空として扱う（プライベートブラウズなどでも動くように）
export function loadPlaylists(storage: Pick<Storage, "getItem"> = localStorage): Playlist[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isPlaylist) : [];
  } catch {
    return [];
  }
}

export function savePlaylists(lists: Playlist[], storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // 保存できなくても画面は動かし続ける
  }
}

export function shareSearch(p: { name: string; items: string[] }): string {
  return `?${new URLSearchParams({ pl: p.name, ids: p.items.join(",") })}`;
}

// 共有 URL から読む。形の合う動画 ID だけを、500件まで通す
export function parseShare(search: string): { name: string; items: string[] } | null {
  const params = new URLSearchParams(search);
  if (!params.has("pl") && !params.has("ids")) return null;
  const items = [...new Set((params.get("ids") ?? "").split(",").filter((id) => VIDEO_ID.test(id)))].slice(0, MAX_SHARE_ITEMS);
  return { name: cleanName(params.get("pl") ?? ""), items };
}

// 次に再生する動画。最後まで来たら、ループなら最初に戻り、そうでなければ null。
// 今の動画が順番に無いとき（一覧から消えたなど）は先頭から
export function nextId(order: string[], currentId: string, loop: boolean): string | null {
  if (order.length === 0) return null;
  const i = order.indexOf(currentId);
  if (i < 0) return order[0];
  if (i + 1 < order.length) return order[i + 1];
  return loop ? order[0] : null;
}

// Fisher–Yates
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

import { DEFAULT_STATE, type State } from "./filter.ts";

const SOURCES: readonly State["src"][] = ["all", "nico", "youtube"];
const SORTS: readonly State["sort"][] = ["new", "views", "likes", "duration"];
const ORDERS: readonly State["order"][] = ["desc", "asc"];
const VIEWS: readonly State["view"][] = ["", "playlists", "playlist"];

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseState(search: string): State {
  const p = new URLSearchParams(search);
  return {
    q: p.get("q") ?? DEFAULT_STATE.q,
    src: pick(p.get("src"), SOURCES, DEFAULT_STATE.src),
    sort: pick(p.get("sort"), SORTS, DEFAULT_STATE.sort),
    order: pick(p.get("order"), ORDERS, DEFAULT_STATE.order),
    chara: p.get("chara") ?? DEFAULT_STATE.chara,
    author: p.get("author") ?? DEFAULT_STATE.author,
    v: p.get("v") ?? DEFAULT_STATE.v,
    view: pick(p.get("view"), VIEWS, DEFAULT_STATE.view),
    list: p.get("list") ?? DEFAULT_STATE.list,
    shuffle: p.get("shuffle") === "1",
  };
}

// 既定値の項目は書かない。全部既定値なら空文字
export function stringifyState(state: State): string {
  const p = new URLSearchParams();
  for (const key of ["view", "list", "v"] as const) {
    if (state[key] !== DEFAULT_STATE[key]) p.set(key, state[key]);
  }
  if (state.shuffle) p.set("shuffle", "1");
  for (const key of ["q", "src", "sort", "order", "chara", "author"] as const) {
    if (state[key] !== DEFAULT_STATE[key]) p.set(key, state[key]);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

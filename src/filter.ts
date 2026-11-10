import { normalize } from "./normalize.ts";
import type { Video } from "./types.ts";

export type State = {
  q: string;
  src: "all" | "nico" | "youtube";
  sort: "new" | "views" | "likes" | "duration";
  order: "desc" | "asc"; // desc は新しい順・多い順・長い順
  chara: string;
  author: string; // 投稿者名
  v: string; // 視聴ページで再生中の動画 ID。一覧のときは空
};

export const DEFAULT_STATE: State = { q: "", src: "all", sort: "new", order: "desc", chara: "", author: "", v: "" };

export type Indexed = { video: Video; haystack: string };

// 検索のたびに正規化しないよう、検索対象の文字列を先に作っておく
export function indexVideos(videos: Video[]): Indexed[] {
  return videos.map((video) => ({
    video,
    haystack: normalize([video.title, ...video.characters, ...video.tags, video.author?.name ?? ""].join(" ")),
  }));
}

// 降順（新しい順・多い順・長い順）で書き、昇順は向きを反対にして使う
const COMPARE: Record<State["sort"], (a: Video, b: Video) => number> = {
  new: (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  views: (a, b) => b.views - a.views,
  likes: (a, b) => b.likes - a.likes,
  duration: (a, b) => b.duration - a.duration,
};

export function filterVideos(items: Indexed[], state: State): Video[] {
  const terms = normalize(state.q).split(/\s+/).filter(Boolean);
  return items
    .filter(({ video, haystack }) =>
      (state.src === "all" || video.source === state.src) &&
      (!state.chara || video.characters.includes(state.chara)) &&
      (!state.author || video.author?.name === state.author) &&
      terms.every((t) => haystack.includes(t)),
    )
    .map((i) => i.video)
    .sort(state.order === "asc" ? (a, b) => COMPARE[state.sort](b, a) : COMPARE[state.sort]);
}

// 視聴ページの「次に見る」。絞り込み結果の並びのまま、再生中の動画だけ除く
export function upNext(results: Video[], currentId: string): Video[] {
  return results.filter((v) => v.id !== currentId);
}

export type Option = { name: string; count: number };

// 絞り込み欄の候補。表記ゆれを吸収して部分一致で探し、元の並び（件数の多い順）を保つ
export function matchOptions(options: Option[], query: string): Option[] {
  const q = normalize(query).trim();
  return q ? options.filter((o) => normalize(o.name).includes(q)) : options;
}

// 件数の多い順。同数なら名前順
function countBy(videos: Video[], keys: (v: Video) => string[]): Option[] {
  const counts = new Map<string, number>();
  for (const v of videos) for (const k of keys(v)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}

export function characterCounts(videos: Video[]): Option[] {
  return countBy(videos, (v) => v.characters);
}

export function authorCounts(videos: Video[]): Option[] {
  return countBy(videos, (v) => (v.author ? [v.author.name] : []));
}

import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, authorCounts, characterCounts, filterVideos, indexVideos, matchOptions, nextInList, upNext } from "../src/filter.ts";
import { makeVideo } from "./helpers.ts";

const videos = [
  makeVideo({ id: "sm1", title: "ばりめん", characters: ["ウインバリアシオン"], tags: ["音MAD"], author: { id: "nico:1", name: "のーめ" }, views: 10, likes: 5, publishedAt: "2026-01-01T00:00:00+09:00" }),
  makeVideo({ id: "sm2", title: "ゴルシ伝説", characters: ["ゴールドシップ"], author: { id: "nico:2", name: "MADer" }, views: 30, likes: 1, publishedAt: "2026-03-01T00:00:00+09:00" }),
  makeVideo({ id: "yt:a", source: "youtube", title: "Miler Dancer", characters: ["ゴールドシップ"], author: { id: "yt:UC1", name: "MADer" }, views: 20, likes: 9, publishedAt: "2026-02-01T00:00:00+09:00" }),
];
const items = indexVideos(videos);
const ids = (vs: { id: string }[]) => vs.map((v) => v.id);

describe("filterVideos", () => {
  it("ANDs space-separated terms across title, characters and tags", () => {
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, q: "ういんばり 音mad" }))).toEqual(["sm1"]);
    expect(filterVideos(items, { ...DEFAULT_STATE, q: "ういんばり 合作" })).toEqual([]);
  });
  it("matches the author name in keyword search", () => {
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, q: "のーめ" }))).toEqual(["sm1"]);
  });
  it("filters by exact author name across sources", () => {
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, author: "MADer" }))).toEqual(["sm2", "yt:a"]);
    expect(filterVideos(items, { ...DEFAULT_STATE, author: "MAD" })).toEqual([]);
  });
  it("treats regex characters literally", () => {
    expect(() => filterVideos(items, { ...DEFAULT_STATE, q: "(*" })).not.toThrow();
    expect(filterVideos(items, { ...DEFAULT_STATE, q: "(*" })).toEqual([]);
  });
  it("ignores whitespace-only query", () => {
    expect(filterVideos(items, { ...DEFAULT_STATE, q: "   " })).toHaveLength(3);
  });
  it("filters by source and exact character", () => {
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, src: "youtube" }))).toEqual(["yt:a"]);
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, chara: "ゴールドシップ" }))).toEqual(["sm2", "yt:a"]);
    expect(filterVideos(items, { ...DEFAULT_STATE, chara: "ゴールド" })).toEqual([]);
  });
  it("sorts by views, likes and newest", () => {
    expect(ids(filterVideos(items, DEFAULT_STATE))).toEqual(["sm2", "yt:a", "sm1"]);
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, sort: "views" }))).toEqual(["sm2", "yt:a", "sm1"]);
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, sort: "likes" }))).toEqual(["yt:a", "sm1", "sm2"]);
  });
});

describe("sort order", () => {
  it("sorts by duration, longest first", () => {
    const vs = indexVideos([
      makeVideo({ id: "a", duration: 30 }),
      makeVideo({ id: "b", duration: 300 }),
      makeVideo({ id: "c", duration: 90 }),
    ]);
    expect(ids(filterVideos(vs, { ...DEFAULT_STATE, sort: "duration" }))).toEqual(["b", "c", "a"]);
  });
  it("reverses every sort with order asc", () => {
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, order: "asc" }))).toEqual(["sm1", "yt:a", "sm2"]);
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, sort: "views", order: "asc" }))).toEqual(["sm1", "yt:a", "sm2"]);
    expect(ids(filterVideos(items, { ...DEFAULT_STATE, sort: "likes", order: "asc" }))).toEqual(["sm2", "sm1", "yt:a"]);
  });
});

describe("characterCounts", () => {
  it("counts characters", () => {
    expect(characterCounts(videos)).toEqual([
      { name: "ゴールドシップ", count: 2 },
      { name: "ウインバリアシオン", count: 1 },
    ]);
  });
});

describe("authorCounts", () => {
  it("counts videos per author name and skips missing authors", () => {
    expect(authorCounts([...videos, makeVideo({ id: "sm9" })])).toEqual([
      { name: "MADer", count: 2 },
      { name: "のーめ", count: 1 },
    ]);
  });
});

describe("upNext", () => {
  it("keeps the filtered order and drops the video being watched", () => {
    const results = filterVideos(items, { ...DEFAULT_STATE, sort: "views" });
    expect(ids(upNext(results, "yt:a"))).toEqual(["sm2", "sm1"]);
  });
  it("returns everything when the watched video is not in the results", () => {
    expect(upNext(videos, "sm999")).toHaveLength(3);
  });
});

describe("matchOptions", () => {
  const options = [
    { name: "ゴールドシップ", count: 77 },
    { name: "キタサンブラック", count: 40 },
    { name: "ゴールドシチー", count: 12 },
  ];
  it("returns every option for an empty query", () => {
    expect(matchOptions(options, "")).toEqual(options);
    expect(matchOptions(options, "  ")).toEqual(options);
  });
  it("matches across hiragana and katakana and keeps the count order", () => {
    expect(matchOptions(options, "ごーるど").map((o) => o.name)).toEqual(["ゴールドシップ", "ゴールドシチー"]);
  });
  it("returns nothing when no name matches", () => {
    expect(matchOptions(options, "スペ")).toEqual([]);
  });
});

describe("nextInList", () => {
  const list = [makeVideo({ id: "a" }), makeVideo({ id: "b" }), makeVideo({ id: "c" })];
  it("goes to the video after the current one, so it never bounces back", () => {
    expect(nextInList(list, "a")?.id).toBe("b");
    expect(nextInList(list, "b")?.id).toBe("c");
  });
  it("stops at the end of the list", () => {
    expect(nextInList(list, "c")).toBeNull();
  });
  it("starts from the top when the current video is not in the list", () => {
    expect(nextInList(list, "zzz")?.id).toBe("a");
    expect(nextInList([], "a")).toBeNull();
  });
});

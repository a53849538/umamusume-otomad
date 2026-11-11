import { describe, it, expect } from "vitest";
import {
  createPlaylist,
  deletePlaylist,
  loadPlaylists,
  moveItem,
  newPlaylistId,
  nextId,
  parseShare,
  removeItem,
  renamePlaylist,
  savePlaylists,
  setLoop,
  shareSearch,
  shuffled,
  swapItems,
  toggleItem,
  type Playlist,
} from "../src/playlists.ts";

const now = new Date("2026-11-11T00:00:00Z");
const one = (items: string[] = []): Playlist[] => [{ id: "pl", name: "x", items, loop: false, createdAt: "" }];

describe("playlist operations", () => {
  it("creates with a trimmed name, or a default when empty", () => {
    const a = createPlaylist([], "  ゴルシ  ", now, "pl-a");
    expect(a).toEqual([{ id: "pl-a", name: "ゴルシ", items: [], loop: false, createdAt: "2026-11-11T00:00:00.000Z" }]);
    expect(createPlaylist([], "   ", now, "pl-b")[0].name).toBe("新しいプレイリスト");
    expect(createPlaylist([], "あ".repeat(60), now, "pl-c")[0].name).toHaveLength(50);
  });

  it("adds new playlists at the end", () => {
    const lists = createPlaylist(createPlaylist([], "a", now, "pl-a"), "b", now, "pl-b");
    expect(lists.map((p) => p.id)).toEqual(["pl-a", "pl-b"]);
  });

  it("makes ids that start with pl-", () => {
    expect(newPlaylistId(() => 0.5)).toMatch(/^pl-[a-z0-9]+$/);
  });

  it("toggles an item on and off without duplicates", () => {
    const added = toggleItem(one(), "pl", "sm1");
    expect(added[0].items).toEqual(["sm1"]);
    expect(toggleItem(added, "pl", "sm1")[0].items).toEqual([]);
  });

  it("moves items and ignores moves past the ends", () => {
    const lists = one(["a", "b", "c"]);
    expect(moveItem(lists, "pl", 0, 1)[0].items).toEqual(["b", "a", "c"]);
    expect(moveItem(lists, "pl", 2, -1)[0].items).toEqual(["a", "c", "b"]);
    expect(moveItem(lists, "pl", 0, -1)[0].items).toEqual(["a", "b", "c"]);
    expect(moveItem(lists, "pl", 2, 1)[0].items).toEqual(["a", "b", "c"]);
  });

  it("swaps two videos by id, even with hidden videos between them", () => {
    // "gone" は一覧から外れて画面に出ない動画。画面では a の次が b に見える
    const lists = one(["a", "gone", "b", "c"]);
    expect(swapItems(lists, "pl", "a", "b")[0].items).toEqual(["b", "gone", "a", "c"]);
    expect(swapItems(lists, "pl", "a", "zzz")[0].items).toEqual(["a", "gone", "b", "c"]);
  });

  it("renames, deletes, removes items and sets loop", () => {
    const lists = one(["a", "b"]);
    expect(renamePlaylist(lists, "pl", " 新しい名前 ")[0].name).toBe("新しい名前");
    expect(renamePlaylist(lists, "pl", "  ")[0].name).toBe("新しいプレイリスト");
    expect(deletePlaylist(lists, "pl")).toEqual([]);
    expect(removeItem(lists, "pl", "a")[0].items).toEqual(["b"]);
    expect(setLoop(lists, "pl", true)[0].loop).toBe(true);
  });

  it("does not change the original array", () => {
    const lists = one(["a"]);
    const before = JSON.stringify(lists);
    toggleItem(lists, "pl", "b");
    moveItem(lists, "pl", 0, 1);
    renamePlaylist(lists, "pl", "y");
    expect(JSON.stringify(lists)).toBe(before);
  });
});

describe("storage", () => {
  it("loads an empty list when storage throws or holds broken JSON", () => {
    expect(loadPlaylists({ getItem: () => { throw new Error("denied"); } })).toEqual([]);
    expect(loadPlaylists({ getItem: () => "{broken" })).toEqual([]);
    expect(loadPlaylists({ getItem: () => null })).toEqual([]);
    // 形の合わない要素だけ捨てる
    const raw = JSON.stringify([{ id: "pl-a", name: "x", items: ["sm1"], loop: false, createdAt: "" }, { id: 1 }, null]);
    expect(loadPlaylists({ getItem: () => raw })).toHaveLength(1);
  });

  it("round-trips through storage", () => {
    let saved = "";
    savePlaylists(one(["sm1"]), { setItem: (_k, v) => void (saved = v) });
    expect(loadPlaylists({ getItem: () => saved })).toEqual(one(["sm1"]));
  });

  it("does not throw when saving fails", () => {
    expect(() => savePlaylists([], { setItem: () => { throw new Error("quota"); } })).not.toThrow();
  });
});

describe("share url", () => {
  it("round-trips a share url", () => {
    const p = { name: "ゴルシ音MAD", items: ["sm1", "yt:abcdefghijk"] };
    expect(parseShare(shareSearch(p))).toEqual(p);
  });

  it("parseShare keeps only valid ids, up to 500", () => {
    expect(parseShare("?pl=x&ids=sm1,<script>,yt:short,so2")?.items).toEqual(["sm1", "so2"]);
    const many = Array.from({ length: 600 }, (_, i) => `sm${i}`).join(",");
    expect(parseShare(`?pl=x&ids=${many}`)?.items).toHaveLength(500);
    expect(parseShare("?q=abc")).toBeNull();
  });
});

describe("play order", () => {
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
});

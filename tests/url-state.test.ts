import { describe, it, expect } from "vitest";
import { DEFAULT_STATE } from "../src/filter.ts";
import { parseState, stringifyState } from "../src/url-state.ts";

describe("url-state", () => {
  it("round-trips Japanese values", () => {
    const s = { ...DEFAULT_STATE, q: "ごーるど 音MAD", chara: "ゴールドシップ", author: "のーめ", v: "yt:abc", order: "asc" as const, sort: "views" as const, src: "nico" as const };
    expect(parseState(stringifyState(s))).toEqual(s);
  });
  it("writes the watched video as v", () => {
    expect(stringifyState({ ...DEFAULT_STATE, v: "sm46933170" })).toBe("?v=sm46933170");
  });
  it("omits defaults", () => {
    expect(stringifyState(DEFAULT_STATE)).toBe("");
    expect(stringifyState({ ...DEFAULT_STATE, sort: "likes" })).toBe("?sort=likes");
  });
  it("writes order only when ascending", () => {
    expect(stringifyState({ ...DEFAULT_STATE, sort: "duration", order: "asc" })).toBe("?sort=duration&order=asc");
    expect(stringifyState({ ...DEFAULT_STATE, order: "desc" })).toBe("");
  });
  it("falls back to descending for an unknown order", () => {
    expect(parseState("?order=sideways").order).toBe("desc");
  });
  it("falls back to default sort", () => {
    expect(parseState("?sort=bogus&src=x").sort).toBe("new");
    expect(parseState("?sort=bogus&src=x").src).toBe("all");
  });
});

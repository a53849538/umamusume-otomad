import { describe, it, expect } from "vitest";
import { formatCount, formatDate, formatDuration } from "../src/format.ts";

describe("format", () => {
  it("formats counts in Japanese units", () => {
    expect(formatCount(9999)).toBe("9,999");
    expect(formatCount(12345)).toBe("1.2万");
    expect(formatCount(123456789)).toBe("1.2億");
  });
  it("formats durations", () => {
    expect(formatDuration(77)).toBe("1:17");
    expect(formatDuration(3723)).toBe("1:02:03");
  });
  it("formats dates in JST", () => {
    expect(formatDate("2026-10-16T23:54:37+09:00")).toBe("2026/10/16");
    expect(formatDate("2026-10-16T15:30:00Z")).toBe("2026/10/17");
  });
});

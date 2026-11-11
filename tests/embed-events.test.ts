import { describe, it, expect } from "vitest";
import { nicoEvent } from "../src/embed-events.ts";

const NICO = "https://embed.nicovideo.jp";

describe("nicoEvent", () => {
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
});

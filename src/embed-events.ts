// ニコ動の埋め込みプレーヤー（?jsapi=1）が postMessage で送ってくる知らせを読む。
// playerId が今のプレーヤーと違うものは、前の動画のプレーヤーからの知らせなので無視する
const NICO_ORIGIN = "https://embed.nicovideo.jp";
const ENDED = 4;

type NicoMessage = { eventName?: unknown; playerId?: unknown; data?: { playerStatus?: unknown } };

export function nicoEvent(origin: string, data: unknown, playerId: string): "loaded" | "ended" | null {
  if (origin !== NICO_ORIGIN || typeof data !== "object" || data === null) return null;
  const m = data as NicoMessage;
  if (String(m.playerId) !== playerId) return null;
  if (m.eventName === "loadComplete") return "loaded";
  if (m.eventName === "playerStatusChange" && m.data?.playerStatus === ENDED) return "ended";
  return null;
}

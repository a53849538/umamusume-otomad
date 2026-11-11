import { nicoEvent } from "./embed-events.ts";
import { formatCount, formatDate } from "./format.ts";
import type { Video } from "./types.ts";

const frame = document.getElementById("watch-frame") as HTMLElement;
const title = document.getElementById("watch-title") as HTMLElement;
const authorName = document.getElementById("watch-author-name") as HTMLElement;
const meta = document.getElementById("watch-meta") as HTMLElement;
const charas = document.getElementById("watch-charas") as HTMLElement;
const link = document.getElementById("watch-link") as HTMLAnchorElement;

const NICO_ORIGIN = "https://embed.nicovideo.jp";

let playingId = "";
let onEndedNow: () => void = () => {};
let youtube: YT.Player | null = null;
let nicoFrame: HTMLIFrameElement | null = null;
let nicoPlayerId = 0; // iframe を作るたびに増やし、前のプレーヤーからの知らせと見分ける

// ニコ動: 読み込みが終わったら再生を命令し（URL の autoplay だけでは始まらない）、終わったら知らせる
window.addEventListener("message", (e) => {
  if (!nicoFrame) return;
  const playerId = String(nicoPlayerId);
  const event = nicoEvent(e.origin, e.data, playerId);
  if (event === "loaded") {
    nicoFrame.contentWindow?.postMessage({ eventName: "play", sourceConnectorType: 1, playerId }, NICO_ORIGIN);
  } else if (event === "ended") {
    onEndedNow();
  }
});

let youtubeApi: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  youtubeApi ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  });
  return youtubeApi;
}

function clearPlayer() {
  youtube?.destroy();
  youtube = null;
  nicoFrame = null;
  frame.replaceChildren();
}

function playNico(video: Video) {
  clearPlayer();
  nicoPlayerId++;
  const iframe = document.createElement("iframe");
  iframe.src = `${NICO_ORIGIN}/watch/${video.id}?jsapi=1&playerId=${nicoPlayerId}&autoplay=1`;
  iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
  iframe.allowFullscreen = true;
  iframe.title = video.title;
  frame.replaceChildren(iframe);
  nicoFrame = iframe;
}

async function playYouTube(video: Video) {
  const videoId = video.id.replace(/^yt:/, "");
  // YouTube から YouTube への切り替えは、プレーヤーを作り直さない
  if (youtube) return youtube.loadVideoById(videoId);
  clearPlayer();
  const holder = document.createElement("div");
  frame.replaceChildren(holder);
  await loadYouTubeApi();
  // API を読み込んでいる間に別の動画に切り替わっていたら何もしない
  if (playingId !== video.id || youtube) return;
  youtube = new YT.Player(holder, {
    host: "https://www.youtube-nocookie.com",
    videoId,
    width: "100%",
    height: "100%",
    playerVars: { autoplay: 1, playsinline: 1 },
    events: { onStateChange: (e) => e.data === 0 && onEndedNow() },
  });
}

// 同じ動画のまま呼ばれたらプレーヤーを作り直さない（絞り込みを変えても再生が止まらないように）。
// onEnded は再生が終わったときに呼ぶ
export function showVideo(video: Video, onEnded: () => void): void {
  onEndedNow = onEnded;
  if (video.id !== playingId) {
    playingId = video.id;
    if (video.source === "youtube") void playYouTube(video);
    else playNico(video);
  }
  // 動画データは textContent で入れる
  title.textContent = video.title;
  authorName.textContent = video.author?.name ?? "";
  meta.textContent = `▶ ${formatCount(video.views)}　♥ ${formatCount(video.likes)}　${formatDate(video.publishedAt)}`;
  charas.textContent = video.characters.join("・");
  link.href = video.url;
}

// 一覧に戻ったらプレーヤーごと消して再生を止める
export function stopVideo(): void {
  clearPlayer();
  playingId = "";
  onEndedNow = () => {};
}

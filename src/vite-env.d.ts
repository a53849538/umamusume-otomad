/// <reference types="vite/client" />

// vite.config.ts の define で、ビルド時のリポジトリ URL が入る（無ければ空文字）
declare const __REPO_URL__: string;

// YouTube IFrame Player API（https://www.youtube.com/iframe_api）のうち、使う分だけ
declare namespace YT {
  interface PlayerOptions {
    host?: string;
    videoId: string;
    width?: string | number;
    height?: string | number;
    playerVars?: Record<string, number | string>;
    events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void };
  }
  class Player {
    constructor(element: HTMLElement, options: PlayerOptions);
    loadVideoById(videoId: string): void;
    destroy(): void;
  }
}

interface Window {
  YT?: { Player: typeof YT.Player };
  onYouTubeIframeAPIReady?: () => void;
}


function unit(n: number, base: number, suffix: string): string {
  return `${(n / base).toFixed(1).replace(/\.0$/, "")}${suffix}`;
}

export function formatCount(n: number): string {
  if (n >= 1e8) return unit(n, 1e8, "億");
  if (n >= 1e4) return unit(n, 1e4, "万");
  return n.toLocaleString("ja-JP");
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const DATE = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

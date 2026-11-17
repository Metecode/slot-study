/* ------------------------------------------------------------------ */
/* Gönderim sonucu — yanıta göre ne yapılacağı                          */
/* ------------------------------------------------------------------ */

/*
  POST /api/events sözleşmesi (CLAUDE.md, Kullanım ölçümü):
  - 202: geçerliler yazıldı, geçersizler atlandı; batch kuyruktan çıkar.
  - 400: zarf bozuk; aynı batch tekrar gönderilse yine reddedilir, atılır.
  - 429: Retry-After kadar beklenir; batch kuyrukta kalır.
  - Ağ hatası, 5xx ve beklenmeyen her kod: artan bekleme, batch kalır.
*/

export type DeliveryOutcome =
  | { kind: "sent" }
  | { kind: "rejected" }
  | { kind: "retryAfter"; delayMs: number }
  | { kind: "backoff" };

/** Retry-After okunamazsa bir dakika: backend'in sınır penceresi. */
const DEFAULT_RETRY_AFTER_MS = 60_000;
const MAX_RETRY_AFTER_MS = 60 * 60_000;

/** @param status ağ hatasında null */
export function deliveryOutcome(status: number | null, retryAfter: string | null, now: Date): DeliveryOutcome {
  if (status === null) return { kind: "backoff" };
  if (status >= 200 && status < 300) return { kind: "sent" };
  // 413: gövde nginx'in sınırını aştı; aynı batch yine aşar.
  if (status === 400 || status === 413) return { kind: "rejected" };
  if (status === 429) return { kind: "retryAfter", delayMs: retryAfterMs(retryAfter, now) };
  return { kind: "backoff" };
}

/** Saniye ya da HTTP tarihi; ikisi de olmazsa varsayılan. 1 sn ile 1 saat arasında tutulur. */
function retryAfterMs(header: string | null, now: Date): number {
  let delay = DEFAULT_RETRY_AFTER_MS;
  if (header !== null && header.trim() !== "") {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) {
      delay = seconds * 1000;
    } else {
      const date = Date.parse(header);
      if (Number.isFinite(date)) delay = date - now.getTime();
    }
  }
  return Math.min(Math.max(delay, 1000), MAX_RETRY_AFTER_MS);
}

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 30 * 60_000;

/**
 * Art arda başarısızlık sayısına göre bekleme: 5 sn, 10 sn, 20 sn… en
 * fazla 30 dk. Jitter (0.5–1 katı): sunucu dönünce bütün istemciler aynı
 * anda saldırmasın.
 *
 * @param failures en az 1
 * @param random [0, 1)
 */
export function backoffDelayMs(failures: number, random: number): number {
  const exponent = Math.min(Math.max(failures, 1) - 1, 20);
  const ceiling = Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_MAX_MS);
  return Math.round(ceiling * (0.5 + random / 2));
}

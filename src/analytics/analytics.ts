import { analyticsTarget, storage } from "../platform";
import { withLock } from "../platform/locks";
import { randomUuid } from "../platform/randomId";
import { createAnalyticsClient } from "./analyticsClient";
import type { SendResult } from "./analyticsClient";
import { createAnalyticsStorage } from "./analyticsStorage";

/* ------------------------------------------------------------------ */
/* Uygulamanın tek ölçüm istemcisi                                     */
/* ------------------------------------------------------------------ */

/*
  Modül seviyesinde tek örnek: StrictMode efektleri iki kez çalıştırsa da
  durum (tercih, bekleme süresi) tek yerde kalır (progressSync ile aynı
  gerekçe). Kurulum kodu burada, kararlar analyticsClient.ts'te.
*/

/**
 * credentials: "omit" — çerez gönderilmez; olay hiçbir oturuma bağlanmasın.
 * keepalive: arka plana geçişte sayfa/WebView isteği öldürse bile gitsin.
 * Gitmezse olaylar kuyrukta kalır, aynı eventId'lerle yeniden gönderilir.
 */
async function send(url: string, body: string, keepalive: boolean): Promise<SendResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive,
      credentials: "omit",
    });
    return { status: response.status, retryAfter: response.headers.get("Retry-After") };
  } catch {
    return null;
  }
}

export const analytics = createAnalyticsClient({
  storage: createAnalyticsStorage(storage),
  send,
  withLock: (fn) => withLock("slot-analytics-queue", fn),
  now: () => new Date(),
  random: Math.random,
  randomUuid,
  endpoint: analyticsTarget.endpoint,
  platform: analyticsTarget.platform,
  appVersion: __APP_VERSION__,
  warn: (message) => {
    if (import.meta.env.DEV) console.warn(message);
  },
});

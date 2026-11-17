import { describe, expect, it } from "vitest";

import { backoffDelayMs, deliveryOutcome } from "./delivery";

const now = new Date("2026-11-17T12:00:00.000Z");

describe("deliveryOutcome", () => {
  it("202 gönderildi", () => {
    expect(deliveryOutcome(202, null, now)).toEqual({ kind: "sent" });
  });

  it("400 ve 413 atılır: tekrar denemenin anlamı yok", () => {
    expect(deliveryOutcome(400, null, now)).toEqual({ kind: "rejected" });
    expect(deliveryOutcome(413, null, now)).toEqual({ kind: "rejected" });
  });

  it("429 Retry-After saniyesine uyar", () => {
    expect(deliveryOutcome(429, "45", now)).toEqual({ kind: "retryAfter", delayMs: 45_000 });
  });

  it("429 HTTP tarihli Retry-After'ı da okur", () => {
    const at = new Date(now.getTime() + 30_000).toUTCString();
    expect(deliveryOutcome(429, at, now)).toEqual({ kind: "retryAfter", delayMs: 30_000 });
  });

  it("429 başlıksız ya da bozuksa bir dakika, aralık 1 sn–1 saat", () => {
    expect(deliveryOutcome(429, null, now)).toEqual({ kind: "retryAfter", delayMs: 60_000 });
    expect(deliveryOutcome(429, "yarın", now)).toEqual({ kind: "retryAfter", delayMs: 60_000 });
    expect(deliveryOutcome(429, "0", now)).toEqual({ kind: "retryAfter", delayMs: 1000 });
    expect(deliveryOutcome(429, "999999", now)).toEqual({ kind: "retryAfter", delayMs: 3_600_000 });
  });

  it("ağ hatası, 5xx ve beklenmeyen kodlar artan beklemeye düşer", () => {
    expect(deliveryOutcome(null, null, now)).toEqual({ kind: "backoff" });
    expect(deliveryOutcome(500, null, now)).toEqual({ kind: "backoff" });
    expect(deliveryOutcome(503, null, now)).toEqual({ kind: "backoff" });
    expect(deliveryOutcome(404, null, now)).toEqual({ kind: "backoff" });
  });
});

describe("backoffDelayMs", () => {
  it("her başarısızlıkta iki katına çıkar", () => {
    expect(backoffDelayMs(1, 1 - Number.EPSILON)).toBeCloseTo(5_000, -1);
    expect(backoffDelayMs(2, 1 - Number.EPSILON)).toBeCloseTo(10_000, -1);
    expect(backoffDelayMs(3, 1 - Number.EPSILON)).toBeCloseTo(20_000, -1);
  });

  it("30 dakikayı aşmaz", () => {
    expect(backoffDelayMs(50, 1 - Number.EPSILON)).toBeLessThanOrEqual(30 * 60_000);
  });

  it("jitter tavanın yarısı ile tamamı arasında", () => {
    expect(backoffDelayMs(3, 0)).toBe(10_000);
    expect(backoffDelayMs(3, 0.5)).toBe(15_000);
  });
});

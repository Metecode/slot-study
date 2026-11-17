import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { QueuedEvent } from "../domain/usageEvents";
import { withLock } from "../platform/locks";
import { createMemoryAdapter } from "../platform/storage/memoryAdapter";
import type { StorageAdapter } from "../platform/storage/StorageAdapter";
import { ANALYTICS_CONSENT_KEY, ANALYTICS_INSTALL_KEY, ANALYTICS_NS, ANALYTICS_QUEUE_KEY } from "../storage/storeKeys";
import { createAnalyticsClient } from "./analyticsClient";
import type { AnalyticsDeps, SendResult } from "./analyticsClient";
import { createAnalyticsStorage } from "./analyticsStorage";

const START = new Date("2026-11-17T12:00:00.000Z").getTime();

/** Arkada süren yazmaların bitmesi: kilit zinciri ve bellek deposu mikro görevlerle ilerliyor. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

type Sent = { url: string; body: { installId: string; platform: string; appVersion: string; events: QueuedEvent[] }; keepalive: boolean };

function setup(overrides: Partial<AnalyticsDeps> = {}, store: StorageAdapter = createMemoryAdapter()) {
  let now = START;
  let uuidCounter = 0;
  const sent: Sent[] = [];
  const responses: SendResult[] = [];
  const warn = vi.fn();
  // Uygulamadaki gibi tek ad: her çağrıda farklı ad hiçbir şeyi sıraya sokmaz
  // ve art arda olaylar birbirinin yazdığını ezer.
  const lockName = `test-${Math.random()}`;

  const client = createAnalyticsClient({
    storage: createAnalyticsStorage(store),
    send: async (url, body, keepalive) => {
      sent.push({ url, body: JSON.parse(body) as Sent["body"], keepalive });
      return responses.length > 0 ? (responses.shift() ?? null) : { status: 202, retryAfter: null };
    },
    withLock: (fn) => withLock(lockName, fn),
    now: () => new Date(now),
    random: () => 0.999,
    randomUuid: () => `00000000-0000-4000-8000-${(++uuidCounter).toString(16).padStart(12, "0")}`,
    endpoint: "/api/events",
    platform: "android",
    appVersion: "1.2.0",
    warn,
    ...overrides,
  });

  return {
    client,
    store,
    sent,
    warn,
    respond: (...results: SendResult[]) => responses.push(...results),
    advance: (ms: number) => {
      now += ms;
    },
    queue: async () => (await store.get<QueuedEvent[]>(ANALYTICS_NS, ANALYTICS_QUEUE_KEY)) ?? [],
    installId: () => store.get<string>(ANALYTICS_NS, ANALYTICS_INSTALL_KEY),
  };
}

async function enabledSetup(overrides: Partial<AnalyticsDeps> = {}) {
  const ctx = setup(overrides);
  await ctx.client.load();
  return ctx;
}

function spins(client: ReturnType<typeof setup>["client"], count: number) {
  for (let i = 0; i < count; i++) client.track({ name: "spin", props: { categoryCount: 2 } });
}

describe("tercih", () => {
  it("kayıt yoksa varsayılan açık, bilgilendirme gösterilmemiş", async () => {
    const { client } = setup();
    expect(await client.load()).toEqual({ enabled: true, noticeShown: false });
  });

  it("okunmadan önce kapalı: hiçbir şey yazılmaz", async () => {
    const ctx = setup();
    spins(ctx.client, 1);
    await settle();
    expect(await ctx.queue()).toEqual([]);
  });

  it("kayıtlı kapatma tercihine uyar", async () => {
    const store = createMemoryAdapter();
    await store.set(ANALYTICS_NS, ANALYTICS_CONSENT_KEY, { enabled: false, noticeShown: true });
    const ctx = setup({}, store);

    expect((await ctx.client.load()).enabled).toBe(false);
    spins(ctx.client, 1);
    await settle();
    expect(await ctx.queue()).toEqual([]);
  });

  it("bozuk tercih kaydı kapalı sayılır", async () => {
    const store = createMemoryAdapter();
    await store.set(ANALYTICS_NS, ANALYTICS_CONSENT_KEY, "bozuk");
    expect(await setup({}, store).client.load()).toEqual({ enabled: false, noticeShown: true });
  });

  it("bilgilendirme gösterildi olarak kaydedilir", async () => {
    const ctx = await enabledSetup();
    await ctx.client.markNoticeShown();
    expect(await ctx.store.get(ANALYTICS_NS, ANALYTICS_CONSENT_KEY)).toEqual({ enabled: true, noticeShown: true });
  });
});

describe("track", () => {
  it("olayı kimlik ve zamanla kuyruğa yazar, kurulum kimliğini üretir", async () => {
    const ctx = await enabledSetup();
    ctx.client.track({ name: "app_open", props: { dueCount: 3 } });
    await settle();

    const [event] = await ctx.queue();
    expect(z.uuid().safeParse(event.eventId).success).toBe(true);
    expect(event).toMatchObject({ name: "app_open", occurredAt: new Date(START).toISOString(), props: { dueCount: 3 } });
    expect(z.uuid().safeParse(await ctx.installId()).success).toBe(true);
  });

  it("geçersiz olayı atlar, hata fırlatmaz", async () => {
    const ctx = await enabledSetup();
    expect(() => ctx.client.track({ name: "spin", props: { categoryCount: 0 } })).not.toThrow();
    await settle();
    expect(await ctx.queue()).toEqual([]);
    expect(ctx.warn).toHaveBeenCalled();
  });

  it("hedef yoksa (native'de adres tanımsız) hiçbir şey yazmaz", async () => {
    const ctx = await enabledSetup({ endpoint: null });
    spins(ctx.client, 1);
    await ctx.client.flush();
    await settle();
    expect(await ctx.queue()).toEqual([]);
    expect(ctx.sent).toEqual([]);
  });

  it("depo hata verirse uygulamaya sızdırmaz", async () => {
    const broken = createMemoryAdapter();
    broken.set = () => Promise.reject(new Error("disk dolu"));
    broken.get = () => Promise.reject(new Error("okunamadı"));
    const ctx = setup({}, broken);

    await expect(ctx.client.load()).resolves.toBeDefined();
    await ctx.client.setEnabled(true);
    expect(() => spins(ctx.client, 1)).not.toThrow();
    await expect(ctx.client.flush()).resolves.toBeUndefined();
    await settle();
  });
});

describe("flush", () => {
  it("202'de batch kuyruktan silinir; zarf sözleşmeye uyar", async () => {
    const ctx = await enabledSetup();
    spins(ctx.client, 3);
    await settle();
    await ctx.client.flush();

    expect(ctx.sent).toHaveLength(1);
    expect(ctx.sent[0].url).toBe("/api/events");
    expect(ctx.sent[0].body).toMatchObject({ installId: await ctx.installId(), platform: "android", appVersion: "1.2.0" });
    expect(ctx.sent[0].body.events).toHaveLength(3);
    expect(await ctx.queue()).toEqual([]);
  });

  it("gönderim başına en fazla 2 batch (100 olay)", async () => {
    const ctx = await enabledSetup();
    spins(ctx.client, 120);
    await settle();
    await ctx.client.flush();

    expect(ctx.sent.map((s) => s.body.events.length)).toEqual([50, 50]);
    expect(await ctx.queue()).toHaveLength(20);
  });

  it("400'de batch atılır ve uyarı verilir", async () => {
    const ctx = await enabledSetup();
    spins(ctx.client, 2);
    await settle();
    ctx.respond({ status: 400, retryAfter: null });
    await ctx.client.flush();

    expect(await ctx.queue()).toEqual([]);
    expect(ctx.warn).toHaveBeenCalledWith(expect.stringContaining("reddedildi"));
  });

  it("429'da Retry-After dolana kadar gönderilmez, olaylar kalır", async () => {
    const ctx = await enabledSetup();
    spins(ctx.client, 2);
    await settle();
    ctx.respond({ status: 429, retryAfter: "30" });
    await ctx.client.flush();
    expect(await ctx.queue()).toHaveLength(2);

    ctx.advance(29_000);
    await ctx.client.flush();
    expect(ctx.sent).toHaveLength(1);

    ctx.advance(1_000);
    await ctx.client.flush();
    expect(ctx.sent).toHaveLength(2);
    expect(await ctx.queue()).toEqual([]);
  });

  it("ağ hatasında tekrar denemede aynı eventId'ler gider", async () => {
    const ctx = await enabledSetup();
    spins(ctx.client, 2);
    await settle();
    ctx.respond(null);
    await ctx.client.flush();
    expect(await ctx.queue()).toHaveLength(2);

    ctx.advance(10_000);
    await ctx.client.flush();

    const ids = (n: number) => ctx.sent[n].body.events.map((e) => e.eventId);
    expect(ctx.sent).toHaveLength(2);
    expect(ids(1)).toEqual(ids(0));
  });

  it("5xx'te bekleme her başarısızlıkta uzar, başarıdan sonra sıfırlanır", async () => {
    const ctx = await enabledSetup();
    spins(ctx.client, 1);
    await settle();

    ctx.respond({ status: 503, retryAfter: null });
    await ctx.client.flush();
    ctx.advance(5_000);
    ctx.respond({ status: 503, retryAfter: null });
    await ctx.client.flush();
    expect(ctx.sent).toHaveLength(2);

    // İkinci başarısızlıktan sonra bekleme ~10 sn: 5 sn yetmez.
    ctx.advance(5_000);
    await ctx.client.flush();
    expect(ctx.sent).toHaveLength(2);

    ctx.advance(5_000);
    await ctx.client.flush();
    expect(ctx.sent).toHaveLength(3);
    expect(await ctx.queue()).toEqual([]);
  });

  it("backend'in reddedeceği eski olaylar gönderilmeden atılır", async () => {
    const ctx = await enabledSetup();
    spins(ctx.client, 1);
    await settle();
    ctx.advance(7 * 24 * 60 * 60 * 1000);
    await ctx.client.flush();

    expect(ctx.sent).toEqual([]);
    expect(await ctx.queue()).toEqual([]);
  });

  it("keepalive seçeneği gönderime geçer", async () => {
    const ctx = await enabledSetup();
    spins(ctx.client, 1);
    await settle();
    await ctx.client.flush({ keepalive: true });
    expect(ctx.sent[0].keepalive).toBe(true);
  });
});

describe("kapatma", () => {
  let ctx: Awaited<ReturnType<typeof enabledSetup>>;

  beforeEach(async () => {
    ctx = await enabledSetup();
    spins(ctx.client, 3);
    await settle();
  });

  it("kuyruk ve kurulum kimliği silinir, tercih kapalı yazılır", async () => {
    await ctx.client.setEnabled(false);

    expect(await ctx.queue()).toEqual([]);
    expect(await ctx.installId()).toBeUndefined();
    expect(await ctx.store.get(ANALYTICS_NS, ANALYTICS_CONSENT_KEY)).toEqual({ enabled: false, noticeShown: false });
  });

  it("kapalıyken olay yazılmaz, gönderim yapılmaz", async () => {
    await ctx.client.setEnabled(false);
    spins(ctx.client, 2);
    await settle();
    await ctx.client.flush();

    expect(await ctx.queue()).toEqual([]);
    expect(ctx.sent).toEqual([]);
  });

  it("kapatmadan hemen önce başlayan yazma kuyruğu yeniden oluşturmaz", async () => {
    spins(ctx.client, 1);
    await ctx.client.setEnabled(false);
    await settle();

    expect(await ctx.queue()).toEqual([]);
    expect(await ctx.installId()).toBeUndefined();
  });

  it("yeniden açılınca yeni kurulum kimliği üretilir", async () => {
    const before = await ctx.installId();
    await ctx.client.setEnabled(false);
    await ctx.client.setEnabled(true);
    spins(ctx.client, 1);
    await settle();

    const after = await ctx.installId();
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
  });
});

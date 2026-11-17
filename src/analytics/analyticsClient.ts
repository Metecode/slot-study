import { eventBatchSchema, usageEventSchema } from "../domain/usageEvents";
import type { QueuedEvent, UsageEvent, UsagePlatform } from "../domain/usageEvents";
import type { AnalyticsStorage, Consent } from "./analyticsStorage";
import { DEFAULT_CONSENT } from "./analyticsStorage";
import { backoffDelayMs, deliveryOutcome } from "./delivery";
import { appendEvent, dropStale, nextBatch, removeEvents } from "./queue";

/* ------------------------------------------------------------------ */
/* Kullanım ölçümü istemcisi — React bilmez                             */
/* ------------------------------------------------------------------ */

/*
  Kural: ölçüm uygulamayı ASLA bozmaz. Dışa açık her fonksiyon hatayı
  yutar; track senkron döner ve hiçbir şey beklemez.

  Kuyruğun tek kaynağı depo, bellekte kopya yok: her adım kilit içinde
  okur, değiştirir, yazar (web'de birden fazla sekme aynı kuyruğu
  paylaşıyor). Ağ isteği kilidin dışında; kilit yalnızca depo adımlarını
  sıraya sokar.

  Bağımlılıklar dışarıdan gelir: testte bellek deposu, sahte fetch ve saat.
*/

/** Backend'in sınırı dakikada 120 olay; tek gönderimde en fazla 100. */
export const MAX_BATCHES_PER_FLUSH = 2;

export type SendResult = { status: number; retryAfter: string | null } | null;

export type AnalyticsDeps = {
  storage: AnalyticsStorage;
  /** Ağ hatasında null döner, fırlatmaz. */
  send: (url: string, body: string, keepalive: boolean) => Promise<SendResult>;
  withLock: <T>(fn: () => Promise<T>) => Promise<T>;
  now: () => Date;
  random: () => number;
  randomUuid: () => string;
  /** null: hedef yok (native'de VITE_API_BASE_URL tanımsız), ölçüm kapalı. */
  endpoint: string | null;
  platform: UsagePlatform;
  appVersion: string;
  /** Yalnızca geliştirmede uyarı; üretimde sessiz. */
  warn: (message: string) => void;
};

export function createAnalyticsClient(deps: AnalyticsDeps) {
  const { storage } = deps;

  // Tercih okunana kadar kapalı: kapatmış bir kullanıcının ilk olayı yazılmasın.
  let consent: Consent = { ...DEFAULT_CONSENT, enabled: false };
  // Kapatma anında artar: kapatmadan önce başlamış bir track sonradan yazmasın.
  let generation = 0;
  let flushing = false;
  let failures = 0;
  let nextAttemptAt = 0;

  const active = () => consent.enabled && deps.endpoint !== null;

  async function safely(label: string, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      deps.warn(`Kullanım ölçümü: ${label} başarısız (${String(error)})`);
    }
  }

  async function ensureInstallId(): Promise<string> {
    const existing = await storage.readInstallId();
    if (existing) return existing;
    const created = deps.randomUuid();
    await storage.writeInstallId(created);
    return created;
  }

  /** Tercihi depodan okur; okunamazsa kapalı kalır. */
  async function load(): Promise<Consent> {
    await safely("tercih okuma", async () => {
      consent = await storage.readConsent();
    });
    return consent;
  }

  /**
   * Kapatınca kuyruk ve kurulum kimliği silinir; açınca bir sonraki olayda
   * yeni kimlik üretilir.
   */
  async function setEnabled(enabled: boolean): Promise<void> {
    if (!enabled) generation++;
    consent = { ...consent, enabled };
    const next = consent;
    await safely("tercih yazma", () =>
      deps.withLock(async () => {
        await storage.writeConsent(next);
        if (!enabled) await storage.clearCollected();
      }),
    );
  }

  async function markNoticeShown(): Promise<void> {
    consent = { ...consent, noticeShown: true };
    const next = consent;
    await safely("bilgilendirme kaydı", () => deps.withLock(() => storage.writeConsent(next)));
  }

  /** Senkron döner; yazma arkada sürer. Geçersiz olay sessizce düşer. */
  function track(event: UsageEvent): void {
    try {
      if (!active()) return;
      const parsed = usageEventSchema.safeParse(event);
      if (!parsed.success) {
        deps.warn(`Kullanım ölçümü: geçersiz olay atlandı (${event.name})`);
        return;
      }
      // Kimlik ve zaman şimdi: tekrar denemelerde aynı eventId gider.
      const queued: QueuedEvent = {
        eventId: deps.randomUuid(),
        name: parsed.data.name,
        occurredAt: deps.now().toISOString(),
        props: parsed.data.props,
      };
      const startedIn = generation;
      void safely("olay yazma", () =>
        deps.withLock(async () => {
          if (!active() || generation !== startedIn) return;
          await ensureInstallId();
          await storage.writeQueue(appendEvent(await storage.readQueue(), queued));
        }),
      );
    } catch (error) {
      deps.warn(`Kullanım ölçümü: olay atlandı (${String(error)})`);
    }
  }

  /** Kuyruktan en fazla MAX_BATCHES_PER_FLUSH batch gönderir. */
  async function flush(options: { keepalive?: boolean } = {}): Promise<void> {
    if (!active() || flushing || deps.now().getTime() < nextAttemptAt) return;
    flushing = true;
    await safely("gönderim", async () => {
      for (let i = 0; i < MAX_BATCHES_PER_FLUSH; i++) {
        if (!(await sendNextBatch(options.keepalive ?? false))) break;
      }
    });
    flushing = false;
  }

  /** Bir batch gönderir; devam edilebilirse true. */
  async function sendNextBatch(keepalive: boolean): Promise<boolean> {
    const prepared = await deps.withLock(async () => {
      const queue = await storage.readQueue();
      const fresh = dropStale(queue, deps.now());
      if (fresh.length !== queue.length) await storage.writeQueue(fresh);
      const installId = await storage.readInstallId();
      return installId ? { installId, events: nextBatch(fresh) } : null;
    });
    if (!prepared || prepared.events.length === 0 || deps.endpoint === null) return false;

    const batch = eventBatchSchema.safeParse({
      installId: prepared.installId,
      platform: deps.platform,
      appVersion: deps.appVersion,
      events: prepared.events,
    });
    const outcome = batch.success
      ? await sendBatch(deps.endpoint, JSON.stringify(batch.data), keepalive)
      : ({ kind: "rejected" } as const);

    switch (outcome.kind) {
      case "sent":
      case "rejected":
        if (outcome.kind === "rejected") {
          // Tekrar denemenin anlamı yok; bir istemci hatası, geliştirmede görünsün.
          deps.warn(`Kullanım ölçümü: ${prepared.events.length} olaylık batch reddedildi, atıldı`);
        }
        failures = 0;
        await deps.withLock(async () =>
          storage.writeQueue(removeEvents(await storage.readQueue(), prepared.events)),
        );
        return outcome.kind === "sent";
      case "retryAfter":
        nextAttemptAt = deps.now().getTime() + outcome.delayMs;
        return false;
      case "backoff":
        failures++;
        nextAttemptAt = deps.now().getTime() + backoffDelayMs(failures, deps.random());
        return false;
    }
  }

  async function sendBatch(url: string, body: string, keepalive: boolean) {
    const result = await deps.send(url, body, keepalive);
    return deliveryOutcome(result?.status ?? null, result?.retryAfter ?? null, deps.now());
  }

  return {
    load,
    setEnabled,
    markNoticeShown,
    track,
    flush,
    consent: (): Consent => consent,
  };
}

export type AnalyticsClient = ReturnType<typeof createAnalyticsClient>;

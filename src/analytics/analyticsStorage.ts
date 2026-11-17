import { z } from "zod";

import { queuedEventSchema } from "../domain/usageEvents";
import type { QueuedEvent } from "../domain/usageEvents";
import type { StorageAdapter } from "../platform/storage/StorageAdapter";
import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_INSTALL_KEY,
  ANALYTICS_NS,
  ANALYTICS_QUEUE_KEY,
} from "../storage/storeKeys";

/* ------------------------------------------------------------------ */
/* Kullanım ölçümünün yerel kaydı: tercih, kurulum kimliği, kuyruk      */
/* ------------------------------------------------------------------ */

export const consentSchema = z.object({
  /** "Kullanım istatistiklerini paylaş". */
  enabled: z.boolean(),
  /** İlk açılış bilgilendirmesi gösterildi mi. */
  noticeShown: z.boolean(),
});
export type Consent = z.infer<typeof consentSchema>;

/** Hiç kayıt yoksa: varsayılan açık, bilgilendirme henüz gösterilmedi. */
export const DEFAULT_CONSENT: Consent = { enabled: true, noticeShown: false };

/**
 * Kayıt var ama okunamıyorsa kapalı: bozuk bir kayıt kullanıcının kapatma
 * tercihi olabilir, sessizce açık sayılmamalı. Bilgilendirme de tekrar çıkmaz.
 */
const UNREADABLE_CONSENT: Consent = { enabled: false, noticeShown: true };

const queueSchema = z.array(queuedEventSchema);

export function createAnalyticsStorage(storage: StorageAdapter) {
  return {
    async readConsent(): Promise<Consent> {
      const raw = await storage.get<unknown>(ANALYTICS_NS, ANALYTICS_CONSENT_KEY);
      if (raw === undefined) return DEFAULT_CONSENT;
      const parsed = consentSchema.safeParse(raw);
      return parsed.success ? parsed.data : UNREADABLE_CONSENT;
    },

    writeConsent(consent: Consent): Promise<void> {
      return storage.set(ANALYTICS_NS, ANALYTICS_CONSENT_KEY, consent);
    },

    async readInstallId(): Promise<string | undefined> {
      const raw = await storage.get<unknown>(ANALYTICS_NS, ANALYTICS_INSTALL_KEY);
      return z.uuid().safeParse(raw).success ? (raw as string) : undefined;
    },

    writeInstallId(installId: string): Promise<void> {
      return storage.set(ANALYTICS_NS, ANALYTICS_INSTALL_KEY, installId);
    },

    /** Okunamayan kuyruk boş sayılır: ölçüm verisi için kurtarma gerekmez. */
    async readQueue(): Promise<QueuedEvent[]> {
      const raw = await storage.get<unknown>(ANALYTICS_NS, ANALYTICS_QUEUE_KEY);
      const parsed = queueSchema.safeParse(raw);
      return parsed.success ? parsed.data : [];
    },

    writeQueue(queue: readonly QueuedEvent[]): Promise<void> {
      return storage.set(ANALYTICS_NS, ANALYTICS_QUEUE_KEY, queue);
    },

    /** Kimlik ve kuyruk; tercih kalır. */
    async clearCollected(): Promise<void> {
      await storage.delete(ANALYTICS_NS, ANALYTICS_QUEUE_KEY);
      await storage.delete(ANALYTICS_NS, ANALYTICS_INSTALL_KEY);
    },
  };
}

export type AnalyticsStorage = ReturnType<typeof createAnalyticsStorage>;

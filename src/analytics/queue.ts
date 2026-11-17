import { MAX_EVENTS_PER_BATCH } from "../domain/usageEvents";
import type { QueuedEvent } from "../domain/usageEvents";

/* ------------------------------------------------------------------ */
/* Olay kuyruğu — saf işlemler                                         */
/* ------------------------------------------------------------------ */

/*
  Olaylar önce yerel kuyruğa yazılır, gönderim sonra: uygulama tam
  çevrimdışı çalışır, kuyruk bir sonraki fırsatta boşalır. Kuyruktan
  yalnızca sunucu kabul ettiğinde (202) ya da batch'i reddettiğinde (400)
  silinir; ağ hatasında aynı olaylar aynı eventId'lerle yeniden gider.
*/

/** Kuyruk tavanı. Taşarsa en eskiler atılır: yeni davranış daha değerli. */
export const MAX_QUEUE_LENGTH = 500;

/**
 * Backend 7 günden eski olayı reddediyor (EventValidator.MAX_PAST).
 * Bir saat pay: cihaz saati biraz geride olsa da sınırdaki olay boşuna
 * gönderilip "skipped" sayılmasın.
 */
export const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;

export function appendEvent(queue: readonly QueuedEvent[], event: QueuedEvent): QueuedEvent[] {
  return [...queue, event].slice(-MAX_QUEUE_LENGTH);
}

/** Sunucunun zaten reddedeceği eski olayları ve okunamayan zamanları atar. */
export function dropStale(queue: readonly QueuedEvent[], now: Date): QueuedEvent[] {
  const oldest = now.getTime() - MAX_EVENT_AGE_MS;
  return queue.filter((event) => {
    const at = Date.parse(event.occurredAt);
    return Number.isFinite(at) && at >= oldest;
  });
}

/** Sıradaki batch: en eski olaylar önce gider. */
export function nextBatch(queue: readonly QueuedEvent[]): QueuedEvent[] {
  return queue.slice(0, MAX_EVENTS_PER_BATCH);
}

/**
 * Gönderilen batch'i kuyruktan çıkarır. id ile, konumla değil: gönderim
 * sürerken yeni olay eklenmiş ya da başka sekme kuyruğu değiştirmiş olabilir.
 */
export function removeEvents(queue: readonly QueuedEvent[], sent: readonly QueuedEvent[]): QueuedEvent[] {
  const ids = new Set(sent.map((event) => event.eventId));
  return queue.filter((event) => !ids.has(event.eventId));
}

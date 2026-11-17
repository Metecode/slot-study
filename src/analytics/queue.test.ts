import { describe, expect, it } from "vitest";

import type { QueuedEvent } from "../domain/usageEvents";
import { MAX_EVENT_AGE_MS, MAX_QUEUE_LENGTH, appendEvent, dropStale, nextBatch, removeEvents } from "./queue";

function event(n: number, occurredAt = "2026-11-17T12:00:00.000Z"): QueuedEvent {
  const hex = n.toString(16).padStart(12, "0");
  return { eventId: `00000000-0000-4000-8000-${hex}`, name: "spin", occurredAt, props: { categoryCount: 1 } };
}

function events(count: number, from = 0): QueuedEvent[] {
  return Array.from({ length: count }, (_, i) => event(from + i));
}

describe("appendEvent", () => {
  it("sona ekler", () => {
    expect(appendEvent(events(2), event(9)).map((e) => e.eventId)).toEqual([event(0), event(1), event(9)].map((e) => e.eventId));
  });

  it("500'ü aşınca en eskiyi atar", () => {
    const full = events(MAX_QUEUE_LENGTH);
    const next = appendEvent(full, event(1000));

    expect(next).toHaveLength(MAX_QUEUE_LENGTH);
    expect(next[0].eventId).toBe(event(1).eventId);
    expect(next.at(-1)?.eventId).toBe(event(1000).eventId);
  });
});

describe("dropStale", () => {
  const now = new Date("2026-11-17T12:00:00.000Z");

  it("backend'in reddedeceği eski olayları atar, sınırdakini tutar", () => {
    const edge = new Date(now.getTime() - MAX_EVENT_AGE_MS).toISOString();
    const tooOld = new Date(now.getTime() - MAX_EVENT_AGE_MS - 1).toISOString();
    const queue = [event(1, tooOld), event(2, edge), event(3, now.toISOString())];

    expect(dropStale(queue, now).map((e) => e.eventId)).toEqual([event(2).eventId, event(3).eventId]);
  });

  it("pay backend'in 7 gününden önce keser", () => {
    expect(MAX_EVENT_AGE_MS).toBeLessThan(7 * 24 * 60 * 60 * 1000);
  });

  it("okunamayan zamanı atar", () => {
    expect(dropStale([event(1, "bozuk")], now)).toEqual([]);
  });
});

describe("nextBatch", () => {
  it("en eski 50 olay", () => {
    const batch = nextBatch(events(120));

    expect(batch).toHaveLength(50);
    expect(batch[0].eventId).toBe(event(0).eventId);
    expect(batch[49].eventId).toBe(event(49).eventId);
  });

  it("kuyruk kısaysa hepsi", () => {
    expect(nextBatch(events(3))).toHaveLength(3);
  });
});

describe("removeEvents", () => {
  it("gönderilenleri id ile çıkarır, sonradan eklenenleri tutar", () => {
    const sent = events(2);
    // Gönderim sürerken başa değil sona yeni olay eklendi, bir olay da başka sekmece silindi.
    const current = [event(1), event(5), event(6)];

    expect(removeEvents(current, sent).map((e) => e.eventId)).toEqual([event(5).eventId, event(6).eventId]);
  });
});

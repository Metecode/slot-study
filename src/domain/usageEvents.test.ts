import { describe, expect, it } from "vitest";

import { eventBatchSchema, usageEventSchema } from "./usageEvents";

/*
  Sınır değerleri backend'deki EventValidatorTest ile aynı. Burada geçen
  bir olay orada da geçmeli; aksi halde sunucu onu sessizce atlar.
*/

function accepts(event: unknown): boolean {
  return usageEventSchema.safeParse(event).success;
}

const selfEval = {
  questionId: "java-equals-hashcode",
  aliasResult: "partial",
  result: "knew",
  box: 3,
  wasDue: true,
};

describe("usageEventSchema", () => {
  it("dört olayı da kabul eder", () => {
    expect(accepts({ name: "app_open", props: { dueCount: 0 } })).toBe(true);
    expect(accepts({ name: "spin", props: { categoryCount: 1 } })).toBe(true);
    expect(accepts({ name: "answer_submitted", props: { questionId: "sql-index", answerLength: 0 } })).toBe(true);
    expect(accepts({ name: "self_eval", props: selfEval })).toBe(true);
  });

  it("listede olmayan adı reddeder", () => {
    expect(accepts({ name: "leitner_review_done", props: { box: 2 } })).toBe(false);
    expect(accepts({ name: "APP_OPEN", props: { dueCount: 0 } })).toBe(false);
  });

  it("aralıkların iki ucu backend'le aynı", () => {
    expect(accepts({ name: "app_open", props: { dueCount: -1 } })).toBe(false);
    expect(accepts({ name: "app_open", props: { dueCount: 10_000 } })).toBe(true);
    expect(accepts({ name: "app_open", props: { dueCount: 10_001 } })).toBe(false);
    expect(accepts({ name: "spin", props: { categoryCount: 0 } })).toBe(false);
    expect(accepts({ name: "spin", props: { categoryCount: 100 } })).toBe(true);
    expect(accepts({ name: "spin", props: { categoryCount: 101 } })).toBe(false);
    expect(accepts({ name: "answer_submitted", props: { questionId: "q", answerLength: 5000 } })).toBe(true);
    expect(accepts({ name: "answer_submitted", props: { questionId: "q", answerLength: 5001 } })).toBe(false);
    expect(accepts({ name: "self_eval", props: { ...selfEval, box: 0 } })).toBe(false);
    expect(accepts({ name: "self_eval", props: { ...selfEval, box: 5 } })).toBe(true);
    expect(accepts({ name: "self_eval", props: { ...selfEval, box: 6 } })).toBe(false);
  });

  it("ondalık, metin olarak sayı ve eksik alanı reddeder", () => {
    expect(accepts({ name: "spin", props: { categoryCount: 3.5 } })).toBe(false);
    expect(accepts({ name: "spin", props: { categoryCount: "3" } })).toBe(false);
    expect(accepts({ name: "app_open", props: {} })).toBe(false);
    const withoutWasDue: Partial<typeof selfEval> = { ...selfEval };
    delete withoutWasDue.wasDue;
    expect(accepts({ name: "self_eval", props: withoutWasDue })).toBe(false);
    expect(accepts({ name: "self_eval", props: { ...selfEval, wasDue: "true" } })).toBe(false);
  });

  it("enum değerleri backend'le aynı", () => {
    for (const aliasResult of ["match", "partial", "none", "skipped"]) {
      for (const result of ["knew", "partial", "didnt"]) {
        expect(accepts({ name: "self_eval", props: { ...selfEval, aliasResult, result } })).toBe(true);
      }
    }
    expect(accepts({ name: "self_eval", props: { ...selfEval, aliasResult: "MATCH" } })).toBe(false);
  });

  it("soru kimliği dar karakter kümesinde", () => {
    const submit = (questionId: string) => accepts({ name: "answer_submitted", props: { questionId, answerLength: 1 } });
    expect(submit("a".repeat(128))).toBe(true);
    expect(submit("a".repeat(129))).toBe(false);
    expect(submit("")).toBe(false);
    expect(submit("bir cevap")).toBe(false);
    expect(submit("ğ-soru")).toBe(false);
  });

  it("props'taki şema dışı alanı atar", () => {
    const parsed = usageEventSchema.parse({ name: "spin", props: { categoryCount: 2, answer: "metin" } });
    expect(parsed.props).toEqual({ categoryCount: 2 });
  });
});

describe("eventBatchSchema", () => {
  const event = {
    eventId: "0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9",
    name: "app_open",
    occurredAt: "2026-11-17T12:00:00.000Z",
    props: { dueCount: 1 },
  };
  const batch = (overrides: object) => ({
    installId: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    platform: "android",
    appVersion: "1.2.0",
    events: [event],
    ...overrides,
  });

  it("geçerli zarfı kabul eder", () => {
    expect(eventBatchSchema.safeParse(batch({})).success).toBe(true);
  });

  it("1–50 olay", () => {
    expect(eventBatchSchema.safeParse(batch({ events: [] })).success).toBe(false);
    expect(eventBatchSchema.safeParse(batch({ events: Array(50).fill(event) })).success).toBe(true);
    expect(eventBatchSchema.safeParse(batch({ events: Array(51).fill(event) })).success).toBe(false);
  });

  it("platform ve sürüm biçimi backend'le aynı", () => {
    expect(eventBatchSchema.safeParse(batch({ platform: "desktop" })).success).toBe(false);
    expect(eventBatchSchema.safeParse(batch({ appVersion: "1.0" })).success).toBe(false);
    expect(eventBatchSchema.safeParse(batch({ appVersion: "1.0.0-beta" })).success).toBe(false);
  });
});

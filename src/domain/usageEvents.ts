import { z } from "zod";

import { MAX_ANSWER_LENGTH } from "./progress";

/* ------------------------------------------------------------------ */
/* Kullanım ölçümü — olay sözleşmesi                                   */
/* ------------------------------------------------------------------ */

/*
  Backend'deki EventPropsSchema (backend/.../analytics/EventPropsSchema.java)
  ve EventValidator ile BİREBİR aynı: ad listesi, alanlar, tipler, aralıklar.
  Biri değişirse öteki de değişir; backend şemada olmayan alanı atar, aralık
  dışını ise olayı atlatarak sessizce kaybeder.

  Cevap METNİ hiçbir olayda yok; yalnızca uzunluğu.
*/

const intBetween = (min: number, max: number) => z.number().int().min(min).max(max);

/** Backend IdField ile aynı: serbest metin bu tabloya girmesin. */
export const QUESTION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const questionId = z.string().regex(QUESTION_ID_PATTERN);

export const ALIAS_RESULTS = ["match", "partial", "none", "skipped"] as const;
export const SELF_EVAL_RESULTS = ["knew", "partial", "didnt"] as const;

export const appOpenPropsSchema = z.object({
  /** Açılış anında vadesi gelmiş kart sayısı (bkz. usageMetrics.dueCountOf). */
  dueCount: intBetween(0, 10_000),
});

export const spinPropsSchema = z.object({
  categoryCount: intBetween(1, 100),
});

export const answerSubmittedPropsSchema = z.object({
  questionId,
  answerLength: intBetween(0, MAX_ANSWER_LENGTH),
});

export const selfEvalPropsSchema = z.object({
  questionId,
  aliasResult: z.enum(ALIAS_RESULTS),
  result: z.enum(SELF_EVAL_RESULTS),
  /** Öz-değerlendirmeden SONRAKİ kutu. */
  box: intBetween(1, 5),
  wasDue: z.boolean(),
});

/** track()'e verilen olay: ad ve ona ait props. */
export const usageEventSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("app_open"), props: appOpenPropsSchema }),
  z.object({ name: z.literal("spin"), props: spinPropsSchema }),
  z.object({ name: z.literal("answer_submitted"), props: answerSubmittedPropsSchema }),
  z.object({ name: z.literal("self_eval"), props: selfEvalPropsSchema }),
]);
export type UsageEvent = z.infer<typeof usageEventSchema>;
export type UsageEventName = UsageEvent["name"];
export type SelfEvalProps = z.infer<typeof selfEvalPropsSchema>;

export const USAGE_EVENT_NAMES = ["app_open", "spin", "answer_submitted", "self_eval"] as const;

/**
 * Kuyruktaki olay: kimliği ve zamanı track() anında verilir, tekrar
 * denemelerde değişmez (backend tekrarları eventId ile ayıklıyor).
 * props burada yeniden doğrulanmaz; track() zaten doğruladı, depodan
 * okurken şekil kontrolü yeter.
 */
export const queuedEventSchema = z.object({
  eventId: z.uuid(),
  name: z.enum(USAGE_EVENT_NAMES),
  occurredAt: z.iso.datetime(),
  props: z.record(z.string(), z.unknown()),
});
export type QueuedEvent = z.infer<typeof queuedEventSchema>;

/** Backend EventValidator.MAX_EVENTS_PER_BATCH. */
export const MAX_EVENTS_PER_BATCH = 50;

export const USAGE_PLATFORMS = ["web", "android", "ios"] as const;
export type UsagePlatform = (typeof USAGE_PLATFORMS)[number];

/** POST /api/events gövdesi. */
export const eventBatchSchema = z.object({
  installId: z.uuid(),
  platform: z.enum(USAGE_PLATFORMS),
  /** package.json sürümü; backend X.Y.Z istiyor. */
  appVersion: z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/),
  events: z.array(queuedEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});
export type EventBatch = z.infer<typeof eventBatchSchema>;

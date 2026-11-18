import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Box, QuestionProgress, SelfRating } from "./progress";
import type { Category, Evaluation, Question } from "./question";
import { initialSessionState, sessionReducer } from "./session";
import { categoryCountOf, dueCountOf, selfEvalPropsOf } from "./usageMetrics";

/* Tekrar günü yerel takvime bağlı (studyDay.ts, 04:00). */
beforeAll(() => {
  vi.stubEnv("TZ", "Europe/Istanbul");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

/** Yerel saat; ay 1'den başlar. */
function local(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute);
}

function makeQuestion(id: string, category: Category = "sql", conceptCount = 3): Question {
  return {
    id,
    category,
    kind: "definition",
    topic: "Index",
    difficulty: 1,
    origin: { kind: "own" },
    prompt: `${id} için soru metni`,
    modelAnswer: "Yeterince uzun bir örnek cevap metni.",
    keyConcepts: Array.from({ length: conceptCount }, (_, i) => ({
      id: `kavram-${i + 1}`,
      label: `Kavram ${i + 1}`,
      aliases: [`kavram${i + 1}`],
      anchors: ["Kavramı anlatan yeterince uzun bir çapa cümlesi."],
    })),
  };
}

function seen(questionId: string, box: Box, at: Date): QuestionProgress {
  return { questionId, box, lastSeenAt: at.toISOString(), attempts: [] };
}

function evaluation(hitCount: number): Evaluation {
  const hits = Array.from({ length: hitCount }, (_, i) => `kavram-${i + 1}`);
  return { source: "lexical", hits, missing: [] };
}

describe("dueCountOf", () => {
  const sqlA = makeQuestion("sql-a", "sql");
  const sqlB = makeQuestion("sql-b", "sql");
  const javaA = makeQuestion("java-a", "java");
  const questions = [sqlA, sqlB, javaA];

  it("yalnızca zamanı gelmiş, seçili kategorideki soruları sayar", () => {
    const now = local(2026, 11, 17, 10);
    const progress = {
      // Kutu 1, dün görüldü: bugün 04:00'dan beri zamanı gelmiş.
      "sql-a": seen("sql-a", 1, local(2026, 11, 16, 20)),
      // Kutu 2, dün görüldü: yarın gelir.
      "sql-b": seen("sql-b", 2, local(2026, 11, 16, 20)),
      // Zamanı gelmiş ama kategori kapalı.
      "java-a": seen("java-a", 1, local(2026, 11, 10, 20)),
    };

    expect(dueCountOf(progress, questions, ["sql"], now)).toBe(1);
    expect(dueCountOf(progress, questions, ["sql", "java"], now)).toBe(2);
  });

  it("gün 04:00'da döner", () => {
    const progress = { "sql-a": seen("sql-a", 1, local(2026, 11, 16, 20)) };

    expect(dueCountOf(progress, questions, ["sql"], local(2026, 11, 17, 3, 59))).toBe(0);
    expect(dueCountOf(progress, questions, ["sql"], local(2026, 11, 17, 4, 0))).toBe(1);
  });

  it("içerikten kalkmış sorunun kaydını saymaz", () => {
    const progress = { "silinmis-soru": seen("silinmis-soru", 1, local(2026, 11, 1)) };

    expect(dueCountOf(progress, questions, ["sql"], local(2026, 11, 17, 10))).toBe(0);
  });

  it("ileri tarihli ya da bozuk kayıt zamanı gelmiş sayılır (çekilişle aynı)", () => {
    const now = local(2026, 11, 17, 10);
    const progress = {
      "sql-a": seen("sql-a", 3, local(2026, 12, 1)),
      "sql-b": { ...seen("sql-b", 1, now), lastSeenAt: "bozuk" },
    };

    expect(dueCountOf(progress, questions, ["sql"], now)).toBe(2);
  });

  it("hiç görülmemiş soru zamanı gelmiş değildir", () => {
    expect(dueCountOf({}, questions, ["sql", "java"], local(2026, 11, 17))).toBe(0);
  });
});

describe("categoryCountOf", () => {
  it("içeriği olmayan seçili kategoriyi saymaz", () => {
    expect(categoryCountOf(["sql", "java", "docker"], ["sql", "java"])).toBe(2);
  });
});

describe("selfEvalPropsOf", () => {
  const question = makeQuestion("sql-a", "sql", 3);
  const now = local(2026, 11, 17, 10);

  const base = {
    question,
    previous: undefined,
    evaluation: evaluation(3),
    passed: false,
    answer: "cevap metni",
    rating: 2 as SelfRating,
    now,
  };

  it("aliasResult kullanıcının gördüğü seviyeden gelir", () => {
    expect(selfEvalPropsOf({ ...base, evaluation: evaluation(3) }).aliasResult).toBe("match");
    expect(selfEvalPropsOf({ ...base, evaluation: evaluation(1) }).aliasResult).toBe("partial");
    expect(selfEvalPropsOf({ ...base, evaluation: evaluation(0) }).aliasResult).toBe("none");
  });

  it("pas geçilen ya da boş gönderilen cevap skipped", () => {
    expect(selfEvalPropsOf({ ...base, passed: true, evaluation: null, answer: "" }).aliasResult).toBe("skipped");
    expect(selfEvalPropsOf({ ...base, answer: "   ", evaluation: evaluation(0) }).aliasResult).toBe("skipped");
  });

  it("puanı result'a çevirir; pas geçildiyse didnt", () => {
    expect(selfEvalPropsOf({ ...base, rating: 0 }).result).toBe("didnt");
    expect(selfEvalPropsOf({ ...base, rating: 1 }).result).toBe("partial");
    expect(selfEvalPropsOf({ ...base, rating: 2 }).result).toBe("knew");
    expect(selfEvalPropsOf({ ...base, rating: 2, passed: true, evaluation: null }).result).toBe("didnt");
  });

  it("wasDue: ilk kez görülen soru false, zamanı gelmiş kayıt true", () => {
    expect(selfEvalPropsOf({ ...base, previous: undefined }).wasDue).toBe(false);
    expect(selfEvalPropsOf({ ...base, previous: seen("sql-a", 1, local(2026, 11, 16, 20)) }).wasDue).toBe(true);
    expect(selfEvalPropsOf({ ...base, previous: seen("sql-a", 3, local(2026, 11, 16, 20)) }).wasDue).toBe(false);
  });

  /*
    box olayda "değerlendirmeden sonraki kutu". Ayrı bir hesap değil,
    reducer'ın gerçekte yazdığı kutu olmalı: aynı girdilerle RATE'in
    sonucuyla karşılaştırılır.
  */
  it.each([
    { box: 1 as Box, rating: 2 as SelfRating, passed: false },
    { box: 3 as Box, rating: 1 as SelfRating, passed: false },
    { box: 4 as Box, rating: 0 as SelfRating, passed: false },
    { box: 5 as Box, rating: 2 as SelfRating, passed: false },
    { box: 4 as Box, rating: 2 as SelfRating, passed: true },
  ])("box reducer'ın RATE sonucuyla aynı ($box, $rating, pas: $passed)", ({ box, rating, passed }) => {
    const previous = seen("sql-a", box, local(2026, 11, 1));
    const state = {
      ...initialSessionState(),
      phase: "evaluated" as const,
      current: question,
      evaluation: passed ? null : evaluation(2),
      passed,
      progress: { "sql-a": previous },
    };

    const after = sessionReducer(state, { type: "RATE", rating, answer: "cevap", now });
    const props = selfEvalPropsOf({ ...base, previous, rating, passed, evaluation: state.evaluation });

    expect(props.box).toBe(after.progress["sql-a"].box);
  });

  it("ilk kez görülen soruda kutu 1'den hesaplanır", () => {
    const state = {
      ...initialSessionState(),
      phase: "evaluated" as const,
      current: question,
      evaluation: evaluation(3),
      passed: false,
    };
    const after = sessionReducer(state, { type: "RATE", rating: 2, answer: "cevap", now });

    expect(selfEvalPropsOf({ ...base, previous: undefined, rating: 2 }).box).toBe(after.progress["sql-a"].box);
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { NEW_PER_DAY_WHILE_DUE, candidatesOf, introducedToday, isDue } from "./drawTiers";
import type { Box, QuestionProgress } from "./progress";
import type { Category, Question } from "./question";

/*
  Tekrar günü ve "bugün" yerel takvime bağlı (studyDay.ts, 04:00).
  Tarihler her testin İÇİNDE kurulur: modül seviyesinde kurulsa saat dilimi
  ayarlanmadan önce hesaplanırdı.
*/
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

function makeQuestion(id: string, category: Category = "sql"): Question {
  return {
    id,
    category,
    kind: "definition",
    topic: "Index",
    difficulty: 1,
    prompt: `${id} için soru metni`,
    modelAnswer: "Yeterince uzun bir örnek cevap metni.",
    keyConcepts: [
      {
        id: "kavram-1",
        label: "Kavram 1",
        aliases: ["birinci"],
        anchors: ["Birinci kavramı anlatan yeterince uzun çapa cümlesi."],
      },
    ],
  };
}

/** `seenAt`'te görülmüş kayıt; `firstAt` verilirse ilk denemesi o an. */
function seen(questionId: string, box: Box, seenAt: Date, firstAt?: Date): QuestionProgress {
  const attempts = firstAt
    ? [
        {
          at: firstAt.toISOString(),
          answer: "",
          hitCount: 0,
          totalConcepts: 1,
          selfRating: 1 as const,
          passed: false,
        },
      ]
    : [];
  return { questionId, box, lastSeenAt: seenAt.toISOString(), attempts };
}

describe("isDue", () => {
  it("tekrar günü 04:00'da gelir: 03:59'da henüz değil", () => {
    const entry = seen("q1", 1, local(2026, 3, 9, 20));
    expect(isDue(entry, local(2026, 3, 10, 3, 59))).toBe(false);
    expect(isDue(entry, local(2026, 3, 10, 4))).toBe(true);
  });

  it("akşam görülen kutu 1 sorusu ertesi gün öğlen gelmiştir, 24 saat dolmadan", () => {
    const entry = seen("q1", 1, local(2026, 3, 9, 20, 30));
    expect(isDue(entry, local(2026, 3, 10, 12))).toBe(true);
  });

  it("aralık dolmadan gelmez", () => {
    // Kutu 3: 4 gün. 10 Mart'ta görülen 14 Mart 04:00'da gelir.
    const entry = seen("q1", 3, local(2026, 3, 10, 9));
    expect(isDue(entry, local(2026, 3, 13, 23))).toBe(false);
    expect(isDue(entry, local(2026, 3, 14, 4))).toBe(true);
  });

  it("ileri tarihli kayıt (saat kayması) zamanı gelmiş sayılır", () => {
    const entry = seen("q1", 3, local(2026, 3, 15, 9));
    expect(isDue(entry, local(2026, 3, 10, 9))).toBe(true);
  });

  it("okunamayan tarih zamanı gelmiş sayılır", () => {
    const entry: QuestionProgress = { questionId: "q1", box: 3, lastSeenAt: "bozuk", attempts: [] };
    expect(isDue(entry, local(2026, 3, 10, 9))).toBe(true);
  });

  it("aralık tablosu dışındaki kutu zamanı gelmiş sayılır", () => {
    const entry = { ...seen("q1", 1, local(2026, 3, 10, 9)), box: 9 as unknown as Box };
    expect(isDue(entry, local(2026, 3, 10, 10))).toBe(true);
  });
});

describe("introducedToday", () => {
  it("ilk denemesi bu çalışma gününde olan kayıtları sayar", () => {
    const now = local(2026, 3, 10, 21);
    const progress = {
      a: seen("a", 1, local(2026, 3, 10, 20), local(2026, 3, 10, 20)),
      b: seen("b", 2, local(2026, 3, 10, 20, 5), local(2026, 3, 10, 4)),
    };
    expect(introducedToday(progress, now)).toBe(2);
  });

  it("dün tanıtılanı ve denemesi olmayanı saymaz", () => {
    const now = local(2026, 3, 10, 21);
    const progress = {
      yesterday: seen("yesterday", 2, local(2026, 3, 10, 20), local(2026, 3, 9, 20)),
      noAttempts: seen("noAttempts", 1, local(2026, 3, 10, 20)),
    };
    expect(introducedToday(progress, now)).toBe(0);
  });

  it("gün 04:00'da döner: gece 02:00'deki deneme önceki güne sayılır", () => {
    const progress = { a: seen("a", 1, local(2026, 3, 10, 2), local(2026, 3, 10, 2)) };
    expect(introducedToday(progress, local(2026, 3, 10, 3, 30))).toBe(1);
    expect(introducedToday(progress, local(2026, 3, 10, 15))).toBe(0);
  });

  it("okunamayan deneme tarihini saymaz", () => {
    const entry = seen("a", 1, local(2026, 3, 10, 20), local(2026, 3, 10, 20));
    const broken = { ...entry, attempts: [{ ...entry.attempts[0], at: "bozuk" }] };
    expect(introducedToday({ a: broken }, local(2026, 3, 10, 21))).toBe(0);
  });
});

describe("candidatesOf", () => {
  // Hepsi 10 Mart akşamı soruluyor.
  const NOW = () => local(2026, 3, 10, 20);
  const pool = () => ["notDue", "due", "unseen"].map((id) => makeQuestion(id));
  const ids = (questions: Question[]) => questions.map((q) => q.id);

  it("günde bir yeni soru: zamanı gelmiş varken ilk yeni soru da aday", () => {
    expect(NEW_PER_DAY_WHILE_DUE).toBe(1);
    const progress = {
      notDue: seen("notDue", 1, local(2026, 3, 10, 9), local(2026, 3, 8, 9)),
      due: seen("due", 1, local(2026, 3, 9, 20), local(2026, 3, 9, 20)),
    };
    const result = candidatesOf(pool(), progress, NOW());
    // Havuz sırası korunur.
    expect(ids(result.questions)).toEqual(["due", "unseen"]);
    expect(result.fallback).toBe(false);
  });

  it("bugün yeni soru tanıtıldıysa zamanı gelmiş varken yeni soru aday olmaz", () => {
    const progress = {
      notDue: seen("notDue", 1, local(2026, 3, 10, 9), local(2026, 3, 10, 9)),
      due: seen("due", 1, local(2026, 3, 9, 20), local(2026, 3, 9, 20)),
    };
    expect(ids(candidatesOf(pool(), progress, NOW()).questions)).toEqual(["due"]);
  });

  it("zamanı gelmiş yoksa yeniler aday, bugün kaç tane tanıtılmış olursa olsun", () => {
    // Bu testte "due" da bugün görülmüş: ikisi de zamanı gelmemiş, ikisi de bugün tanıtılmış.
    const progress = {
      notDue: seen("notDue", 1, local(2026, 3, 10, 9), local(2026, 3, 10, 9)),
      due: seen("due", 1, local(2026, 3, 10, 10), local(2026, 3, 10, 10)),
    };
    const result = candidatesOf(pool(), progress, NOW());
    expect(ids(result.questions)).toEqual(["unseen"]);
    expect(result.fallback).toBe(false);
  });

  it("yalnızca zamanı gelmemişler kaldıysa hepsi aday, yedek katman", () => {
    const questions = [makeQuestion("a"), makeQuestion("b")];
    const progress = {
      a: seen("a", 1, local(2026, 3, 10, 9)),
      b: seen("b", 3, local(2026, 3, 8, 9)),
    };
    const result = candidatesOf(questions, progress, NOW());
    expect(ids(result.questions)).toEqual(["a", "b"]);
    expect(result.fallback).toBe(true);
  });

  it("boş olmayan havuzda aday listesi hiç boş kalmaz", () => {
    const cases: Record<string, QuestionProgress>[] = [
      {},
      { notDue: seen("notDue", 1, local(2026, 3, 10, 9)) },
      {
        notDue: seen("notDue", 1, local(2026, 3, 10, 9)),
        due: seen("due", 1, local(2026, 3, 10, 9)),
        unseen: seen("unseen", 1, local(2026, 3, 10, 9)),
      },
    ];
    for (const progress of cases) {
      expect(candidatesOf(pool(), progress, NOW()).questions.length).toBeGreaterThan(0);
    }
  });

  it("girdiyi değiştirmez", () => {
    const questions = pool();
    const progress = { due: seen("due", 1, local(2026, 3, 9, 20), local(2026, 3, 9, 20)) };
    const snapshot = JSON.stringify({ questions, progress });
    candidatesOf(questions, progress, NOW());
    expect(JSON.stringify({ questions, progress })).toBe(snapshot);
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { BOX_INTERVALS_DAYS } from "./leitner";
import type { Attempt, Box, QuestionProgress } from "./progress";
import type { Category, Question } from "./question";
import { countRatings, nextReminderAt, shouldOfferReminder } from "./reminder";
import type { ReminderInput, ReminderOfferInput } from "./reminder";

/* ------------------------------------------------------------------ */
/* Saat dilimi — testler yerel takvime bağlı                           */
/* ------------------------------------------------------------------ */

/*
  nextReminderAt yerel takvimle çalışıyor; sonuç çalıştığı makinenin saat
  dilimine bağlı. Varsayılan İstanbul (yaz saati yok), yaz saati testleri
  Berlin'de. Tarihler her testin İÇİNDE kurulur: modül seviyesinde kurulsa
  saat dilimi ayarlanmadan önce hesaplanırdı.
*/
function useTimeZone(tz: string): void {
  // stubEnv process.env.TZ'yi yazar; Node saat dilimini anında değiştirir.
  beforeAll(() => {
    vi.stubEnv("TZ", tz);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

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

/** Tekrar zamanı tam `due` olacak şekilde görülmüş bir kayıt. */
function dueProgress(questionId: string, due: Date, box: Box = 1): QuestionProgress {
  const seenAt = new Date(due.getTime() - BOX_INTERVALS_DAYS[box - 1] * DAY_MS);
  return { questionId, box, lastSeenAt: seenAt.toISOString(), attempts: [] };
}

function makeInput(over: Partial<ReminderInput> & Pick<ReminderInput, "now">): ReminderInput {
  return {
    progress: {},
    questions: [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("d1", "docker")],
    activeCategories: ["sql"],
    ...over,
  };
}

/* ------------------------------------------------------------------ */
/* nextReminderAt                                                      */
/* ------------------------------------------------------------------ */

describe("nextReminderAt", () => {
  useTimeZone("Europe/Istanbul");

  it("saat dilimi gerçekten İstanbul: 19:00 yerel 16:00 UTC", () => {
    expect(local(2026, 3, 11, 19).toISOString()).toBe("2026-03-11T16:00:00.000Z");
  });

  describe("hatırlatacak bir şey yoksa null", () => {
    it("hiç ilerleme yok", () => {
      expect(nextReminderAt(makeInput({ now: local(2026, 3, 10, 14) }))).toBeNull();
    });

    it("seçili kategori yok", () => {
      const now = local(2026, 3, 10, 14);
      const input = makeInput({
        now,
        activeCategories: [],
        progress: { q1: dueProgress("q1", local(2026, 3, 9, 8)) },
      });
      expect(nextReminderAt(input)).toBeNull();
    });

    it("kapalı kategorideki zamanı gelmiş soru sayılmaz", () => {
      const now = local(2026, 3, 10, 14);
      const input = makeInput({ now, progress: { d1: dueProgress("d1", local(2026, 3, 9, 8)) } });
      expect(nextReminderAt(input)).toBeNull();
    });

    it("içerikten kalkmış sorunun ilerlemesi sayılmaz", () => {
      const now = local(2026, 3, 10, 14);
      const input = makeInput({ now, progress: { eski: dueProgress("eski", local(2026, 3, 9, 8)) } });
      expect(nextReminderAt(input)).toBeNull();
    });

    it("tarihi okunamayan kayıt sayılmaz", () => {
      const now = local(2026, 3, 10, 14);
      const broken: QuestionProgress = { questionId: "q1", box: 1, lastSeenAt: "bozuk", attempts: [] };
      expect(nextReminderAt(makeInput({ now, progress: { q1: broken } }))).toBeNull();
    });
  });

  it("bozuk kayıt diğerlerini engellemez", () => {
    const now = local(2026, 3, 10, 14);
    const broken: QuestionProgress = { questionId: "q1", box: 1, lastSeenAt: "bozuk", attempts: [] };
    const input = makeInput({
      now,
      progress: { q1: broken, q2: dueProgress("q2", local(2026, 3, 13, 8)) },
    });
    expect(nextReminderAt(input)).toEqual(local(2026, 3, 13, 19));
  });

  it("hepsinin zamanı gelmişse yarın 19:00", () => {
    const now = local(2026, 3, 10, 14);
    const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 3, 1, 8)) } });
    expect(nextReminderAt(input)).toEqual(local(2026, 3, 11, 19));
  });

  it("zamanı bugün gelecek olsa da bugün değil yarın 19:00 (ertesi gün kuralı)", () => {
    const now = local(2026, 3, 10, 10);
    const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 3, 10, 15)) } });
    expect(nextReminderAt(input)).toEqual(local(2026, 3, 11, 19));
  });

  it("zamanı üç gün sonra sabah geliyorsa o gün 19:00", () => {
    const now = local(2026, 3, 10, 14);
    const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 3, 13, 8), 3) } });
    expect(nextReminderAt(input)).toEqual(local(2026, 3, 13, 19));
  });

  it("zamanı o gün 19:00'dan sonra geliyorsa ertesi gün 19:00", () => {
    const now = local(2026, 3, 10, 14);
    const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 3, 13, 20)) } });
    expect(nextReminderAt(input)).toEqual(local(2026, 3, 14, 19));
  });

  it("zamanı tam 19:00'da geliyorsa o an", () => {
    const now = local(2026, 3, 10, 14);
    const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 3, 13, 19)) } });
    expect(nextReminderAt(input)).toEqual(local(2026, 3, 13, 19));
  });

  it("birden çok sorudan en erken zamanlıyı alır", () => {
    const now = local(2026, 3, 10, 14);
    const input = makeInput({
      now,
      progress: {
        q1: dueProgress("q1", local(2026, 3, 20, 8), 5),
        q2: dueProgress("q2", local(2026, 3, 15, 8), 4),
      },
    });
    expect(nextReminderAt(input)).toEqual(local(2026, 3, 15, 19));
  });

  describe("gece yarısı sınırı", () => {
    it("23:59'da kullanan için ertesi gün 19:00", () => {
      const now = local(2026, 3, 10, 23, 59);
      const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 3, 1, 8)) } });
      expect(nextReminderAt(input)).toEqual(local(2026, 3, 11, 19));
    });

    it("00:01'de kullanan için o gün değil, bir sonraki gün 19:00", () => {
      const now = local(2026, 3, 11, 0, 1);
      const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 3, 1, 8)) } });
      expect(nextReminderAt(input)).toEqual(local(2026, 3, 12, 19));
    });

    it("yıl sonunda yeni yılın ilk günü 19:00", () => {
      const now = local(2026, 12, 31, 21);
      const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 12, 30, 8)) } });
      expect(nextReminderAt(input)).toEqual(local(2027, 1, 1, 19));
    });
  });

  it("girdiyi değiştirmez", () => {
    const now = local(2026, 3, 10, 14);
    const before = now.getTime();
    const progress = { q1: dueProgress("q1", local(2026, 3, 1, 8)) };
    const snapshot = JSON.stringify(progress);

    nextReminderAt(makeInput({ now, progress }));

    expect(now.getTime()).toBe(before);
    expect(JSON.stringify(progress)).toBe(snapshot);
  });
});

describe("nextReminderAt — yaz saati (Europe/Berlin)", () => {
  useTimeZone("Europe/Berlin");

  it("ileri alma gününde (29 Mart 2026) yerel 19:00 = 17:00 UTC", () => {
    const now = local(2026, 3, 28, 12);
    const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 3, 20, 8)) } });

    const at = nextReminderAt(input);

    expect(at?.toISOString()).toBe("2026-03-29T17:00:00.000Z");
    expect(at?.getHours()).toBe(19);
  });

  it("geri alma gününde (25 Ekim 2026) yerel 19:00 = 18:00 UTC", () => {
    const now = local(2026, 10, 24, 12);
    const input = makeInput({ now, progress: { q1: dueProgress("q1", local(2026, 10, 20, 8)) } });

    const at = nextReminderAt(input);

    expect(at?.toISOString()).toBe("2026-10-25T18:00:00.000Z");
    expect(at?.getHours()).toBe(19);
  });

  it("geçişin iki yakasında: zamanı geçişten sonraki gün 19:00'da kalır", () => {
    // 27 Mart 20:00'da görülen kutu 2 sorusu: 48 saat sonra, geçiş yüzünden
    // yerel 29 Mart 21:00. 19:00'ı geçtiği için hatırlatma 30 Mart 19:00.
    const now = local(2026, 3, 27, 20);
    const seen = local(2026, 3, 27, 20);
    const progress: Record<string, QuestionProgress> = {
      q1: { questionId: "q1", box: 2, lastSeenAt: seen.toISOString(), attempts: [] },
    };

    const at = nextReminderAt(makeInput({ now, progress }));

    expect(at).toEqual(local(2026, 3, 30, 19));
    expect(at?.getHours()).toBe(19);
  });
});

/* ------------------------------------------------------------------ */
/* Öneri kartı                                                          */
/* ------------------------------------------------------------------ */

describe("shouldOfferReminder", () => {
  const eligible: ReminderOfferInput = {
    available: true,
    enabled: false,
    offerShown: false,
    totalRatings: 5,
    ratedThisSession: true,
  };

  it("native'de, kapalıyken, ilk kez, beşinci değerlendirmeden sonra gösterilir", () => {
    expect(shouldOfferReminder(eligible)).toBe(true);
  });

  it("dört değerlendirmede henüz gösterilmez", () => {
    expect(shouldOfferReminder({ ...eligible, totalRatings: 4 })).toBe(false);
  });

  it("web'de hiç gösterilmez", () => {
    expect(shouldOfferReminder({ ...eligible, available: false })).toBe(false);
  });

  it("hatırlatıcı zaten açıksa gösterilmez", () => {
    expect(shouldOfferReminder({ ...eligible, enabled: true })).toBe(false);
  });

  it("bir kez gösterildiyse bir daha gösterilmez", () => {
    expect(shouldOfferReminder({ ...eligible, offerShown: true })).toBe(false);
  });

  it("eşiği geçmiş kullanıcı da bu oturumda bir tur bitirmeden görmez", () => {
    expect(shouldOfferReminder({ ...eligible, totalRatings: 40, ratedThisSession: false })).toBe(false);
  });
});

describe("countRatings", () => {
  const attempt: Attempt = {
    at: "2026-01-10T09:00:00.000Z",
    answer: "",
    hitCount: 0,
    totalConcepts: 1,
    selfRating: 1,
    passed: false,
  };

  it("tüm sorulardaki denemeleri toplar", () => {
    const progress: Record<string, QuestionProgress> = {
      q1: { questionId: "q1", box: 1, lastSeenAt: attempt.at, attempts: [attempt, attempt] },
      q2: { questionId: "q2", box: 2, lastSeenAt: attempt.at, attempts: [attempt, attempt, attempt] },
    };
    expect(countRatings(progress)).toBe(5);
  });

  it("ilerleme yoksa 0", () => {
    expect(countRatings({})).toBe(0);
  });
});

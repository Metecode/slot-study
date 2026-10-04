import { describe, expect, it } from "vitest";

import {
  MAX_RECENT_IDS,
  initialSessionState,
  sessionReducer,
  toStore,
} from "./session";
import type { SessionState } from "./session";
import { SCHEMA_VERSION } from "./progress";
import type { QuestionProgress, Store } from "./progress";
import { CATEGORIES } from "./question";
import type { Category, Evaluation, Question } from "./question";

const NOW = new Date("2026-04-01T10:00:00.000Z");

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
      {
        id: "kavram-2",
        label: "Kavram 2",
        aliases: ["ikinci"],
        anchors: ["İkinci kavramı anlatan yeterince uzun çapa cümlesi."],
      },
    ],
  };
}

function makeState(over: Partial<SessionState> = {}): SessionState {
  return { ...initialSessionState(), ...over };
}

function makeEvaluation(over: Partial<Evaluation> = {}): Evaluation {
  return {
    source: "lexical",
    hits: ["kavram-1"],
    missing: ["kavram-2"],
    ...over,
  };
}

/** Çekiliş testte belirleyici olsun diye rng hep havuzun ilkini seçer. */
const firstPick = () => 0;

describe("geçersiz geçişler", () => {
  it("answering'de SPIN state'i değiştirmez", () => {
    const state = makeState({
      phase: "answering",
      current: makeQuestion("q1"),
    });

    const next = sessionReducer(state, {
      type: "SPIN",
      questions: [makeQuestion("q1"), makeQuestion("q2")],
      now: NOW,
      rng: firstPick,
    });

    expect(next).toBe(state);
  });

  it("idle'da SUBMIT state'i değiştirmez", () => {
    const state = makeState({ phase: "idle" });

    const next = sessionReducer(state, {
      type: "SUBMIT",
      evaluation: makeEvaluation(),
    });

    expect(next).toBe(state);
    expect(next.evaluation).toBeNull();
  });

  it("spinning'de SETTLE dışındaki eylemler geçmez", () => {
    const state = makeState({ phase: "spinning", current: makeQuestion("q1") });

    expect(sessionReducer(state, { type: "PASS" })).toBe(state);
    expect(
      sessionReducer(state, { type: "SUBMIT", evaluation: makeEvaluation() }),
    ).toBe(state);
    expect(
      sessionReducer(state, { type: "TOGGLE_CATEGORY", category: "sql" }),
    ).toBe(state);
  });

  it("idle'da RATE state'i değiştirmez", () => {
    const state = makeState({ phase: "idle", current: makeQuestion("q1") });

    const next = sessionReducer(state, {
      type: "RATE",
      rating: 2,
      answer: "cevap",
      now: NOW,
    });

    expect(next).toBe(state);
    expect(next.progress).toEqual({});
  });

  it("bilinmeyen eylem state'i değiştirmez", () => {
    const state = makeState();
    // Kaçak bir eylem tipi reducer'ı kırmamalı.
    const next = sessionReducer(state, { type: "NOPE" } as never);
    expect(next).toBe(state);
  });
});

describe("TOGGLE_CATEGORY", () => {
  it("seçili olmayan kategoriyi ekler", () => {
    const next = sessionReducer(makeState(), {
      type: "TOGGLE_CATEGORY",
      category: "react",
    });
    expect(next.activeCategories).toEqual(["react"]);
  });

  it("seçili kategoriyi çıkarır", () => {
    const state = makeState({ activeCategories: ["react", "sql"] });

    const next = sessionReducer(state, {
      type: "TOGGLE_CATEGORY",
      category: "react",
    });

    expect(next.activeCategories).toEqual(["sql"]);
    // Gelen dizi değişmemeli.
    expect(state.activeCategories).toEqual(["react", "sql"]);
  });
});

describe("SET_CATEGORIES", () => {
  it("aktif kategori listesini olduğu gibi değiştirir", () => {
    const next = sessionReducer(makeState({ activeCategories: ["react"] }), {
      type: "SET_CATEGORIES",
      categories: ["sql", "docker"],
    });
    expect(next.activeCategories).toEqual(["sql", "docker"]);
  });

  it("spinning'de state'i değiştirmez", () => {
    const state = makeState({ phase: "spinning", current: makeQuestion("q1") });

    const next = sessionReducer(state, { type: "SET_CATEGORIES", categories: ["sql"] });

    expect(next).toBe(state);
  });
});

describe("SPIN", () => {
  it("çekiliş null dönerse phase idle kalır", () => {
    const state = makeState({ phase: "idle" });

    const next = sessionReducer(state, {
      type: "SPIN",
      questions: [],
      now: NOW,
      rng: firstPick,
    });

    expect(next).toBe(state);
    expect(next.phase).toBe("idle");
    expect(next.current).toBeNull();
  });

  it("hiç kategori seçilmemişken çevrilemez", () => {
    // Yeni oturum boş kategoriyle başlar; arayüz önce seçim istemeli.
    const state = makeState({ phase: "idle", activeCategories: [] });

    const next = sessionReducer(state, {
      type: "SPIN",
      questions: [makeQuestion("q1")],
      now: NOW,
      rng: firstPick,
    });

    expect(next).toBe(state);
    expect(next.current).toBeNull();
  });

  it("aktif kategoride soru yoksa phase idle kalır", () => {
    const state = makeState({ phase: "idle", activeCategories: ["react"] });

    const next = sessionReducer(state, {
      type: "SPIN",
      questions: [makeQuestion("q1", "sql")],
      now: NOW,
      rng: firstPick,
    });

    expect(next.phase).toBe("idle");
    expect(next.current).toBeNull();
  });

  it("soru bulunca spinning'e geçer ve önceki turu temizler", () => {
    const state = makeState({
      phase: "evaluated",
      current: makeQuestion("q-onceki"),
      evaluation: makeEvaluation(),
      passed: true,
      activeCategories: ["sql"],
    });

    const next = sessionReducer(state, {
      type: "SPIN",
      questions: [makeQuestion("q1")],
      now: NOW,
      rng: firstPick,
    });

    expect(next.phase).toBe("spinning");
    expect(next.current?.id).toBe("q1");
    expect(next.evaluation).toBeNull();
    expect(next.passed).toBe(false);
  });
});

describe("RATE", () => {
  it("pas geçilen soruda kutuyu 1 yapar ve rating'i yok sayar", () => {
    const existing: QuestionProgress = {
      questionId: "q1",
      box: 4,
      lastSeenAt: "2026-03-01T10:00:00.000Z",
      attempts: [],
    };
    const state = makeState({
      phase: "evaluated",
      current: makeQuestion("q1"),
      evaluation: null,
      passed: true,
      progress: { q1: existing },
    });

    // "Biliyordum" gönderilse bile pas kararı ağır basmalı.
    const next = sessionReducer(state, {
      type: "RATE",
      rating: 2,
      answer: "",
      now: NOW,
    });

    expect(next.progress.q1.box).toBe(1);
    const attempt = next.progress.q1.attempts.at(-1)!;
    expect(attempt.passed).toBe(true);
    expect(attempt.selfRating).toBe(0);
    expect(state.progress.q1.box).toBe(4);
  });

  it("pas geçilmemiş soruda rating kutuyu yükseltir", () => {
    const state = makeState({
      phase: "evaluated",
      current: makeQuestion("q1"),
      evaluation: makeEvaluation(),
      progress: {
        q1: {
          questionId: "q1",
          box: 2,
          lastSeenAt: "2026-03-01T10:00:00.000Z",
          attempts: [],
        },
      },
    });

    const next = sessionReducer(state, {
      type: "RATE",
      rating: 2,
      answer: "cevabım",
      now: NOW,
    });

    expect(next.progress.q1.box).toBe(3);
    expect(next.phase).toBe("idle");
  });

  it("ilk kez cevaplanan soru için ilerleme kaydı açar", () => {
    const state = makeState({
      phase: "evaluated",
      current: makeQuestion("q-yeni"),
      evaluation: makeEvaluation({ hits: ["kavram-1", "kavram-2"] }),
    });

    const next = sessionReducer(state, {
      type: "RATE",
      rating: 1,
      answer: "cevabım",
      now: NOW,
    });

    const created = next.progress["q-yeni"];
    expect(created.questionId).toBe("q-yeni");
    // Kutu 1'den başlar, rating 1 kutuyu korur.
    expect(created.box).toBe(1);
    expect(created.lastSeenAt).toBe(NOW.toISOString());
    expect(created.attempts).toHaveLength(1);
    expect(created.attempts[0].hitCount).toBe(2);
    expect(created.attempts[0].totalConcepts).toBe(2);
  });

  it("tur kapanınca oturumu temizler", () => {
    const state = makeState({
      phase: "evaluated",
      current: makeQuestion("q1"),
      evaluation: makeEvaluation(),
      passed: true,
    });

    const next = sessionReducer(state, {
      type: "RATE",
      rating: 0,
      answer: "",
      now: NOW,
    });

    expect(next.phase).toBe("idle");
    expect(next.current).toBeNull();
    expect(next.evaluation).toBeNull();
    expect(next.passed).toBe(false);
    // Temizlik denemeyi yutmamalı; kayıt yine de düşmüş olmalı.
    expect(next.progress.q1.attempts).toHaveLength(1);
    expect(next.recentIds).toEqual(["q1"]);
  });

  it("recentIds 10'da sabitlenir ve en eskisi düşer", () => {
    const seeded = Array.from({ length: MAX_RECENT_IDS }, (_, i) => `q${i}`);
    const state = makeState({
      phase: "evaluated",
      current: makeQuestion("q-yeni"),
      evaluation: makeEvaluation(),
      recentIds: seeded,
    });

    const next = sessionReducer(state, {
      type: "RATE",
      rating: 1,
      answer: "cevabım",
      now: NOW,
    });

    expect(next.recentIds).toHaveLength(MAX_RECENT_IDS);
    // "q0" düştü, "q1" başa geçti, yeni soru sona eklendi.
    expect(next.recentIds[0]).toBe("q1");
    expect(next.recentIds.at(-1)).toBe("q-yeni");
    expect(next.recentIds).not.toContain("q0");
    expect(state.recentIds).toHaveLength(MAX_RECENT_IDS);
  });

  it("sınırın altındaki geçmişe sadece ekler", () => {
    const state = makeState({
      phase: "evaluated",
      current: makeQuestion("q-yeni"),
      evaluation: makeEvaluation(),
      recentIds: ["q1", "q2"],
    });

    const next = sessionReducer(state, {
      type: "RATE",
      rating: 1,
      answer: "cevabım",
      now: NOW,
    });

    expect(next.recentIds).toEqual(["q1", "q2", "q-yeni"]);
  });
});

describe("tam tur", () => {
  it("idle -> spinning -> answering -> evaluated -> idle", () => {
    const questions = [makeQuestion("q1")];
    // Boş kategori listesiyle çekiliş null döner; tur kategori seçimiyle başlar.
    let state = sessionReducer(initialSessionState(), {
      type: "TOGGLE_CATEGORY",
      category: "sql",
    });

    state = sessionReducer(state, {
      type: "SPIN",
      questions,
      now: NOW,
      rng: firstPick,
    });
    expect(state.phase).toBe("spinning");

    state = sessionReducer(state, { type: "SETTLE" });
    expect(state.phase).toBe("answering");

    state = sessionReducer(state, {
      type: "SUBMIT",
      evaluation: makeEvaluation(),
    });
    expect(state.phase).toBe("evaluated");
    expect(state.evaluation?.hits).toEqual(["kavram-1"]);

    state = sessionReducer(state, {
      type: "RATE",
      rating: 2,
      answer: "cevabım",
      now: NOW,
    });
    expect(state.phase).toBe("idle");
    expect(state.progress.q1.box).toBe(2);
    expect(state.recentIds).toEqual(["q1"]);
  });

  it("PASS turu evaluated'a taşır ve değerlendirmeyi temizler", () => {
    const state = makeState({
      phase: "answering",
      current: makeQuestion("q1"),
      evaluation: makeEvaluation(),
    });

    const next = sessionReducer(state, { type: "PASS" });

    expect(next.phase).toBe("evaluated");
    expect(next.passed).toBe(true);
    expect(next.evaluation).toBeNull();
  });
});

describe("SYNC_PROGRESS", () => {
  const merged: Record<string, QuestionProgress> = {
    q1: { questionId: "q1", box: 4, lastSeenAt: "2026-03-01T10:00:00.000Z", attempts: [] },
  };

  it("ilerlemeyi sunucudan geleniyle değiştirir", () => {
    const state = makeState({
      progress: {
        q1: { questionId: "q1", box: 1, lastSeenAt: "2026-01-01T10:00:00.000Z", attempts: [] },
      },
    });

    const next = sessionReducer(state, { type: "SYNC_PROGRESS", progress: merged });

    expect(next.progress).toEqual(merged);
  });

  it("tur ortasında da uygulanır, ekrandaki soruya dokunmaz", () => {
    const question = makeQuestion("q9");
    const state = makeState({
      phase: "answering",
      current: question,
      activeCategories: ["sql"],
    });

    const next = sessionReducer(state, { type: "SYNC_PROGRESS", progress: merged });

    expect(next.progress).toEqual(merged);
    expect(next.phase).toBe("answering");
    expect(next.current).toBe(question);
  });
});

describe("HYDRATE", () => {
  const saved: QuestionProgress = {
    questionId: "q1",
    box: 3,
    lastSeenAt: "2026-03-01T10:00:00.000Z",
    attempts: [],
  };

  // initialized: true varsayılanı, "kullanıcı daha önce seçim yaptı"
  // senaryolarını test eder; ilk açılış davranışı ayrı testlerde.
  function makeSettings(over: Partial<Store["settings"]> = {}): Store["settings"] {
    return {
      fastMode: false,
      soundEnabled: false,
      soundHintShown: false,
      hapticsEnabled: true,
      reminderEnabled: false,
      reminderOfferShown: false,
      lang: "tr",
      activeCategories: ["sql"],
      initialized: true,
      ...over,
    };
  }

  it("ilerlemeyi ve kategori seçimini doldurur", () => {
    const next = sessionReducer(makeState(), {
      type: "HYDRATE",
      progress: { q1: saved },
      settings: makeSettings({ activeCategories: ["sql", "react"] }),
      contentCategories: [],
    });

    expect(next.progress).toEqual({ q1: saved });
    expect(next.activeCategories).toEqual(["sql", "react"]);
  });

  it("içerikte olmayan kategori adını eler", () => {
    const next = sessionReducer(makeState(), {
      type: "HYDRATE",
      progress: {},
      // "cobol" şemada string olarak geçerli ama Category değil.
      settings: makeSettings({ activeCategories: ["sql", "cobol"] }),
      contentCategories: [],
    });

    expect(next.activeCategories).toEqual(["sql"]);
  });

  it("ilk açılışta (initialized false) tüm kategoriler seçili gelir", () => {
    const next = sessionReducer(makeState(), {
      type: "HYDRATE",
      progress: {},
      settings: makeSettings({ initialized: false, activeCategories: [] }),
      contentCategories: [],
    });

    expect(next.activeCategories).toEqual([...CATEGORIES]);
  });

  it("kullanıcı hepsini kapatıp yeniden yüklediğinde boş kalır", () => {
    // initialized true + boş dizi: bilinçli bir seçim, hepsini açmak onu geri alır.
    const next = sessionReducer(makeState(), {
      type: "HYDRATE",
      progress: {},
      settings: makeSettings({ initialized: true, activeCategories: [] }),
      contentCategories: [],
    });

    expect(next.activeCategories).toEqual([]);
  });

  it("sonradan gelen kategoriyi açar ve bilinenleri state'e yazar", () => {
    // Ayrıntılı kurallar categoryHydration.test.ts'te; burada bağlantı.
    const next = sessionReducer(makeState(), {
      type: "HYDRATE",
      progress: {},
      settings: makeSettings({ activeCategories: ["sql"], knownCategories: ["sql", "react"] }),
      contentCategories: ["java", "sql", "react"],
    });

    expect(next.activeCategories).toEqual(["sql", "java"]);
    expect(next.knownCategories).toEqual(["java", "sql", "react"]);
  });

  it("idle dışında state'i değiştirmez", () => {
    // Cevap yazılırken diskten gelen veri ekrandakini ezmemeli.
    const state = makeState({ phase: "answering", current: makeQuestion("q1") });

    const next = sessionReducer(state, {
      type: "HYDRATE",
      progress: { q1: saved },
      settings: makeSettings(),
      contentCategories: [],
    });

    expect(next).toBe(state);
  });
});

describe("toStore", () => {
  it("yalnızca kalıcı alanları süzer", () => {
    const progress: Record<string, QuestionProgress> = {
      q1: { questionId: "q1", box: 2, lastSeenAt: NOW.toISOString(), attempts: [] },
    };
    const state = makeState({
      phase: "evaluated",
      current: makeQuestion("q1"),
      evaluation: makeEvaluation(),
      passed: true,
      recentIds: ["q1"],
      activeCategories: ["sql"],
      knownCategories: ["sql", "react"],
      progress,
    });

    const store = toStore(state, {
      fastMode: true,
      soundEnabled: true,
      soundHintShown: true,
      hapticsEnabled: false,
      reminderEnabled: true,
      reminderOfferShown: true,
    });

    expect(store).toEqual({
      schemaVersion: SCHEMA_VERSION,
      progress,
      settings: {
        fastMode: true,
        soundEnabled: true,
        soundHintShown: true,
        hapticsEnabled: false,
        reminderEnabled: true,
        reminderOfferShown: true,
        lang: "tr",
        activeCategories: ["sql"],
        knownCategories: ["sql", "react"],
        initialized: true,
      },
    });
  });

  it("initialized'ı her zaman true yazar", () => {
    // toStore'a giren state bir oturumdan geldiği için "ilk açılış" artık geçmişte.
    const store = toStore(makeState(), {
      fastMode: false,
      soundEnabled: false,
      soundHintShown: false,
      hapticsEnabled: true,
      reminderEnabled: false,
      reminderOfferShown: false,
    });

    expect(store.settings.initialized).toBe(true);
  });

});

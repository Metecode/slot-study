import { hydrateCategories } from "./categoryHydration";
import { drawQuestion } from "./draw";
import { applyAttempt } from "./leitner";
import { SCHEMA_VERSION } from "./progress";
import type { Attempt, QuestionProgress, SelfRating, Store } from "./progress";
import type { Category, Evaluation, Question } from "./question";

/* ------------------------------------------------------------------ */
/* Oturum — tek turun durum makinesi                                   */
/* ------------------------------------------------------------------ */

/**
 * idle      — makara duruyor, çevrilmeyi bekliyor
 * spinning  — kazanan belli, animasyon oynuyor
 * answering — soru açık, kullanıcı yazıyor
 * evaluated — geri bildirim verildi, kutu kararı bekleniyor
 */
export type Phase = "idle" | "spinning" | "answering" | "evaluated";

export type SessionState = {
  phase: Phase;
  current: Question | null;
  evaluation: Evaluation | null;
  passed: boolean;
  progress: Record<string, QuestionProgress>;
  /** Son sorulanlar, eskiden yeniye. Çekilişte soğutma için kullanılır. */
  recentIds: string[];
  activeCategories: Category[];
  /**
   * Kullanıcının gördüğü kategoriler. Yalnızca HYDRATE yazar; oturum
   * boyunca değişmez, diske aynen geri yazılır.
   */
  knownCategories: Category[];
};

export type SessionAction =
  | {
      type: "HYDRATE";
      progress: Record<string, QuestionProgress>;
      settings: Store["settings"];
      /** İçinde soru olan kategoriler (AVAILABLE_CATEGORIES). */
      contentCategories: readonly Category[];
    }
  | {
      /**
       * Sunucudan dönen birleşmiş ilerleme. HYDRATE'ten ayrı bir eylem:
       * o yalnızca açılışta anlamlı ve kategori seçimine de karışıyor,
       * bu ise yalnızca ilerlemeyi değiştirir.
       */
      type: "SYNC_PROGRESS";
      progress: Record<string, QuestionProgress>;
    }
  | { type: "TOGGLE_CATEGORY"; category: Category }
  | { type: "SET_CATEGORIES"; categories: Category[] }
  | {
      type: "SPIN";
      questions: readonly Question[];
      now: Date;
      rng: () => number;
    }
  | { type: "SETTLE" }
  | { type: "SUBMIT"; evaluation: Evaluation }
  | { type: "PASS" }
  | { type: "RATE"; rating: SelfRating; answer: string; now: Date };

/** Geçmişte tutulan soru sayısı. Soğutma penceresinden geniş olmalı. */
export const MAX_RECENT_IDS = 10;

export function initialSessionState(): SessionState {
  return {
    phase: "idle",
    current: null,
    evaluation: null,
    passed: false,
    progress: {},
    recentIds: [],
    activeCategories: [],
    knownCategories: [],
  };
}

/** İlk kez cevaplanan soru kutu 1'den başlar. */
function newProgress(questionId: string, at: string): QuestionProgress {
  return { questionId, box: 1, lastSeenAt: at, attempts: [] };
}

/**
 * Saf reducer: değerlendirme dışarıdan gelir, burada hesaplanmaz.
 * Geçersiz eylem hata fırlatmaz — aynı state nesnesi döner ki
 * React gereksiz render etmesin.
 */
export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "HYDRATE": {
      // Yalnızca açılışta anlamlı. Tur başladıktan sonra diskten gelen veri
      // ekrandakini ezerse kullanıcı yazdığı cevabı kaybeder.
      if (state.phase !== "idle") return state;

      // İlk açılış, eski kayıt ve sonradan gelen kategoriler:
      // bkz. categoryHydration.ts.
      const { activeCategories, knownCategories } = hydrateCategories(
        action.settings,
        action.contentCategories,
      );

      return {
        ...state,
        progress: action.progress,
        activeCategories,
        knownCategories,
      };
    }

    case "SYNC_PROGRESS": {
      // Tur ortasında da uygulanabilir, HYDRATE'in aksine: reducer
      // ilerlemeyi yalnızca RATE anında okuyor, ekrandaki soru ve
      // kullanıcının yazdığı cevap bundan etkilenmiyor.
      return { ...state, progress: action.progress };
    }

    case "TOGGLE_CATEGORY": {
      // Makara dönerken filtre değişirse ekrandaki kazanan havuz dışı kalır.
      if (state.phase === "spinning") return state;

      const isActive = state.activeCategories.includes(action.category);
      return {
        ...state,
        activeCategories: isActive
          ? state.activeCategories.filter((c) => c !== action.category)
          : [...state.activeCategories, action.category],
      };
    }

    case "SET_CATEGORIES": {
      // Tümünü seç / tümünü kaldır: makara dönerken filtre değişmesin.
      if (state.phase === "spinning") return state;
      return { ...state, activeCategories: action.categories };
    }

    case "SPIN": {
      // Cevap yazılırken çevirmek yazılanı sessizce siler.
      if (state.phase !== "idle" && state.phase !== "evaluated") return state;

      const next = drawQuestion({
        questions: action.questions,
        progress: state.progress,
        activeCategories: state.activeCategories,
        recentIds: state.recentIds,
        now: action.now,
        rng: action.rng,
      });

      // Havuz boş ya da hiçbir kategori eşleşmedi: makara boşa dönmesin.
      if (!next) return state;

      return {
        ...state,
        phase: "spinning",
        current: next,
        evaluation: null,
        passed: false,
      };
    }

    case "SETTLE": {
      // Animasyonun bittiğini yalnızca dönen makara bildirebilir.
      if (state.phase !== "spinning") return state;
      return { ...state, phase: "answering" };
    }

    case "SUBMIT": {
      if (state.phase !== "answering") return state;
      return { ...state, phase: "evaluated", evaluation: action.evaluation };
    }

    case "PASS": {
      if (state.phase !== "answering") return state;
      // Pas geçildi: gösterilecek değerlendirme yok, model cevabı yeter.
      return { ...state, phase: "evaluated", evaluation: null, passed: true };
    }

    case "RATE": {
      if (state.phase !== "evaluated" || !state.current) return state;

      const question = state.current;
      const attempt: Attempt = {
        at: action.now.toISOString(),
        answer: action.answer,
        hitCount: state.evaluation?.hits.length ?? 0,
        // Kavram sayısı sorunun kendisinden gelir; değerlendirme atlanmış olabilir.
        totalConcepts: question.keyConcepts.length,
        // Pas geçildiyse verilen rating yok sayılır. Geçmişte de "bilmiyordum"
        // olarak durur, yoksa kutu 1 ile kayıt birbirini tutmaz.
        selfRating: state.passed ? 0 : action.rating,
        passed: state.passed,
      };

      const existing =
        state.progress[question.id] ?? newProgress(question.id, attempt.at);

      return {
        ...state,
        // Tur kapandı: idle'a dönerken ekranda da state'te de soru kalmamalı,
        // yoksa "makara duruyor ama elimde soru var" gibi tutarsız bir an olur.
        phase: "idle",
        current: null,
        evaluation: null,
        passed: false,
        progress: {
          ...state.progress,
          [question.id]: applyAttempt(existing, attempt),
        },
        // En eskisi baştan düşer, sıra eskiden yeniye korunur.
        recentIds: [...state.recentIds, question.id].slice(-MAX_RECENT_IDS),
      };
    }

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Diske yazılacak biçim                                               */
/* ------------------------------------------------------------------ */

/**
 * State'in kalıcı kısmını süzer. Parametre tipi `Pick`: phase, current,
 * evaluation gibi oturuma özel alanlar diske hiç ulaşmasın diye imza
 * bunlara bakmadığını kendi söylüyor.
 *
 * Ayarlar (fastMode, ses, titreşim, hatırlatıcı...) state'te tutulmuyor
 * (HYDRATE de doldurmuyor), o yüzden dışarıdan geliyor — App'te düz React
 * state, reducer'ın işi değil.
 */
export function toStore(
  state: Pick<SessionState, "progress" | "activeCategories" | "knownCategories">,
  settings: Pick<
    Store["settings"],
    | "fastMode"
    | "soundEnabled"
    | "soundHintShown"
    | "hapticsEnabled"
    | "reminderEnabled"
    | "reminderOfferShown"
  >,
): Store {
  return {
    schemaVersion: SCHEMA_VERSION,
    progress: state.progress,
    settings: {
      fastMode: settings.fastMode,
      soundEnabled: settings.soundEnabled,
      soundHintShown: settings.soundHintShown,
      hapticsEnabled: settings.hapticsEnabled,
      reminderEnabled: settings.reminderEnabled,
      reminderOfferShown: settings.reminderOfferShown,
      // Dil seçimi henüz hiçbir yerde tutulmuyor; şema varsayılanı kalıyor.
      lang: "tr",
      activeCategories: state.activeCategories,
      knownCategories: state.knownCategories,
      // Oturum bir kez HYDRATE olduysa artık "ilk açılış" değildir; boş
      // seçim de dahil, kullanıcının seçimi olduğu gibi diske yazılır.
      initialized: true,
    },
  };
}

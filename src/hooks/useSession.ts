import { useCallback, useMemo, useReducer, useState } from "react";

import { AVAILABLE_CATEGORIES, QUESTIONS } from "../content";
import { evaluateLexical } from "../domain/evaluate";
import type { SelfRating, Store } from "../domain/progress";
import type { Category } from "../domain/question";
import { initialSessionState, sessionReducer } from "../domain/session";
import type { SessionState } from "../domain/session";
import type { ProgressMap } from "../sync/progressSync";

/* ------------------------------------------------------------------ */
/* Oturum reducer'ının React tarafı                                    */
/*                                                                     */
/* Kararlar domain/session.ts'te; burası eylemleri kuruyor ve turun      */
/* son cevabını tutuyor. Efekt içermez: App'teki efekt sırası bu hook'un */
/* nerede çağrıldığından etkilenmesin.                                 */
/* ------------------------------------------------------------------ */

/**
 * İlk state, diskten geleni HYDRATE ile uygulayarak kurulur.
 * HYDRATE'i efektte dispatch etmek yerine burada uygulamak sıralama
 * sorununu tamamen kaldırıyor: efekt sırası yüzünden kayıt, hidrasyondan
 * önceki boş state'i diske basamıyor.
 *
 * Hangi kategorilerin açık geleceğine (ilk açılış, sonradan gelen
 * kategori) reducer karar veriyor — bkz. domain/categoryHydration.ts.
 */
function initState(store: Store): SessionState {
  return sessionReducer(initialSessionState(), {
    type: "HYDRATE",
    progress: store.progress,
    settings: store.settings,
    contentCategories: AVAILABLE_CATEGORIES,
  });
}

export function useSession(store: Store) {
  const [state, dispatch] = useReducer(sessionReducer, store, initState);
  const [lastAnswer, setLastAnswer] = useState("");

  // Senkronun onMerged'i: kimliği sabit kalmalı, useProgressSync ona bağlı.
  const applySync = useCallback((merged: ProgressMap) => {
    dispatch({ type: "SYNC_PROGRESS", progress: merged });
  }, []);

  // Kategori seçicisinin yanındaki havuz bilgisi: aktif kategorilerdeki soru sayısı.
  const { activeCategories } = state;
  const activeQuestionCount = useMemo(
    () => QUESTIONS.filter((q) => activeCategories.includes(q.category)).length,
    [activeCategories],
  );

  function pull() {
    dispatch({ type: "SPIN", questions: QUESTIONS, now: new Date(), rng: Math.random });
  }

  function settle() {
    dispatch({ type: "SETTLE" });
  }

  function submit(answer: string) {
    if (!state.current) return;
    const question = state.current;
    // RATE denemeyi kaydederken cevabı istiyor; kart o an sökülmüş olacak.
    setLastAnswer(answer);
    dispatch({ type: "SUBMIT", evaluation: evaluateLexical(question, answer) });
  }

  function pass() {
    setLastAnswer("");
    dispatch({ type: "PASS" });
  }

  function rate(rating: SelfRating) {
    dispatch({ type: "RATE", rating, answer: lastAnswer, now: new Date() });
  }

  function toggleCategory(category: Category) {
    dispatch({ type: "TOGGLE_CATEGORY", category });
  }

  function toggleAllCategories() {
    // Kıyas görünen kategoriler üzerinden: içeriği olmayan bir kategori
    // seçimde kalmış olabilir, uzunluk karşılaştırması onu da sayardı.
    const allSelected = AVAILABLE_CATEGORIES.every((category) =>
      state.activeCategories.includes(category),
    );
    dispatch({
      type: "SET_CATEGORIES",
      categories: allSelected ? [] : [...AVAILABLE_CATEGORIES],
    });
  }

  const canSpin =
    (state.phase === "idle" || state.phase === "evaluated") &&
    state.activeCategories.length > 0;

  return {
    state,
    lastAnswer,
    canSpin,
    activeQuestionCount,
    applySync,
    pull,
    settle,
    submit,
    pass,
    rate,
    toggleCategory,
    toggleAllCategories,
  };
}

import { useRef } from "react";

import { createFeedbackGate } from "../domain/resultFeedback";
import { RESULT_FEEDBACK_GAP_MS } from "../domain/spinTiming";
import type { SpinPlan } from "../domain/spinTiming";
import { haptics } from "../platform/haptics";
import { useMachineSound } from "./useMachineSound";

/* ------------------------------------------------------------------ */
/* Dönüşün sesi ve titreşimi — moda göre, tek kapıdan                   */
/*                                                                     */
/* Hangi geri bildirimin çalacağını plan söyler (domain/spinTiming.ts): */
/* Kapalı modda kol sesi, kol titreşimi ve tıklar yok. Sonuç (duruş)     */
/* sesi ve titreşimi her modda var ama kapıdan geçer: iki tambur aynı    */
/* anda durduğunda (atlama, Kapalı) bir kez çalar.                      */
/* ------------------------------------------------------------------ */

export type SpinFeedback = {
  /** Kolun kullanıcı hareketinde: ses context'i burada açılır. */
  unlock: () => void;
  /** Çekiliş bildirildi. */
  leverPulled: (plan: SpinPlan) => void;
  /** Satır tıkı; dinleyici yoksa undefined (Drum şeridi hiç izlemez). */
  rowPass: (plan: SpinPlan) => (() => void) | undefined;
  /** Bir tambur durdu. */
  reelStopped: (plan: SpinPlan) => void;
};

export function useSpinFeedback(soundEnabled: boolean): SpinFeedback {
  const sound = useMachineSound(soundEnabled);
  // Kapı oturum boyunca tek: aralık ölçüsü zaman, çekişler arası sıfırlamaya gerek yok.
  const gateRef = useRef(createFeedbackGate(RESULT_FEEDBACK_GAP_MS));

  return {
    unlock: sound.unlock,
    leverPulled(plan) {
      if (!plan.leverFeedback) return;
      // Ses ve titreşim aynı anda: kol çekişinin tek anı burası.
      sound.lever(plan.soundScale);
      haptics.leverPull();
    },
    rowPass(plan) {
      return soundEnabled && plan.ticks ? sound.tick : undefined;
    },
    reelStopped(plan) {
      if (!gateRef.current(performance.now())) return;
      sound.stop(plan.soundScale);
      haptics.reelStop();
    },
  };
}

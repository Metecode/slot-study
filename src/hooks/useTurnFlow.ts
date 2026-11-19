import { useEffect, useRef, useState } from "react";

import { trackAnswerSubmitted, trackSelfEval, trackSpin } from "../analytics/trackers";
import { countRatings } from "../domain/reminder";
import { spinStarted } from "../domain/spinStart";
import type { SelfRating } from "../domain/progress";
import type { useSession } from "./useSession";

/* ------------------------------------------------------------------ */
/* Bir turun akışı: dönüş anahtarı, cevap ve değerlendirme              */
/*                                                                     */
/* Oturum eylemlerinin çevresindeki yan işler burada toplanıyor: ölçüm, */
/* senkrona tek soru gönderme, hatırlatıcı önerisi. App yalnızca        */
/* bağlıyor. Efekt içerir (spinKey): App'te kullanım ölçümünden SONRA   */
/* çağrılır, bölmeden önceki sıra buydu.                               */
/* ------------------------------------------------------------------ */

type Session = ReturnType<typeof useSession>;

export type TurnFlowInput = {
  session: Session;
  /** Senkrona tek soru: değerlendirilen soru hemen gönderilir. */
  pushQuestion: (questionId: string) => void;
  /** Hatırlatıcı öneri kartı: kaçıncı değerlendirmede açılacağına kendisi karar verir. */
  offerReminderAfterRating: (ratingCount: number) => void;
};

export type TurnFlow = {
  /** Her gerçek dönüşte artar; Machine yeni dönüşü buradan anlar. */
  spinKey: number;
  handleSubmit: (answer: string) => void;
  handleRate: (rating: SelfRating) => void;
};

export function useTurnFlow({ session, pushQuestion, offerReminderAfterRating }: TurnFlowInput): TurnFlow {
  const { state } = session;
  const [spinKey, setSpinKey] = useState(0);
  const prevPhaseRef = useRef(state.phase);

  // spinKey yalnızca gerçek bir dönüş başladığında artar — çekiliş havuzu
  // boşsa reducer state'i değiştirmez, Machine'e anlamsız bir dönüş gitmez.
  // spin olayı da burada: reducer çekilişi reddederse olay da gitmez.
  useEffect(() => {
    if (spinStarted(prevPhaseRef.current, state.phase)) {
      setSpinKey((key) => key + 1);
      trackSpin(state.activeCategories);
    }
    prevPhaseRef.current = state.phase;
  }, [state]);

  function handleSubmit(answer: string) {
    if (state.current) trackAnswerSubmitted(state.current, answer);
    session.submit(answer);
  }

  function handleRate(rating: SelfRating) {
    // Soru id'si dispatch'ten önce alınır: RATE turu kapatınca current null olur.
    if (state.current) pushQuestion(state.current.id);
    // Ölçüm de önce: değerlendirmeden önceki kutu ve kayıt yalnızca şimdi elde.
    if (state.phase === "evaluated" && state.current) {
      trackSelfEval({
        question: state.current,
        previous: state.progress[state.current.id],
        evaluation: state.evaluation,
        passed: state.passed,
        answer: session.lastAnswer,
        rating,
        now: new Date(),
      });
    }
    session.rate(rating);
    // Bu değerlendirme henüz state'e yansımadı.
    offerReminderAfterRating(countRatings(state.progress) + 1);
  }

  return { spinKey, handleSubmit, handleRate };
}

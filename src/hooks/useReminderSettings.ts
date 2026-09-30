import { useState } from "react";

import type { Store } from "../domain/progress";
import { shouldOfferReminder } from "../domain/reminder";
import { platformFeatures } from "../platform";
import { reminders } from "../platform/reminders";

/* ------------------------------------------------------------------ */
/* Hatırlatıcı ayarı, izin durumu ve öneri kartı                       */
/*                                                                     */
/* Bildirimi kuran useReviewReminder BİLEREK burada çağrılmıyor: App'te */
/* store yazma ve senkron efektlerinden sonra çağrılıyor, efekt sırası  */
/* bölmeden önceki haliyle aynı kalsın diye.                           */
/* ------------------------------------------------------------------ */

export type ReminderSettings = {
  enabled: boolean;
  /** Diske yazılır: kart bir kez gösterildiyse bir daha çıkmaz. */
  offerShown: boolean;
  /** İzin reddi notu; oturumluk, diske yazılmaz. */
  denied: boolean;
  /** Bu oturumda açılan öneri kartı; oturumluk, diske yazılmaz. */
  offerOpen: boolean;
  /** İzni ister; verilirse hatırlatıcıyı açar. Anahtar ve öneri kartı ortak. */
  enable: () => Promise<boolean>;
  change: (enabled: boolean) => void;
  /** Bir değerlendirmeden sonra; totalRatings o değerlendirmeyi de sayar. */
  offerAfterRating: (totalRatings: number) => void;
  closeOffer: () => void;
  /** İzin sistemden kaldırılmış: anahtar kapanır, açıklama gösterilir. */
  permissionLost: () => void;
};

export function useReminderSettings(initial: Store["settings"]): ReminderSettings {
  const [enabled, setEnabled] = useState(initial.reminderEnabled);
  const [offerShown, setOfferShown] = useState(initial.reminderOfferShown);
  const [denied, setDenied] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);

  async function enable(): Promise<boolean> {
    const granted = (await reminders.requestPermission()) === "granted";
    setEnabled(granted);
    setDenied(!granted);
    return granted;
  }

  // İzin yalnızca kullanıcı açtığında istenir; kapatmak izne dokunmaz.
  function change(value: boolean) {
    if (value) {
      void enable();
      return;
    }
    setEnabled(false);
    setDenied(false);
  }

  // Öneri kartı değerlendirmenin ardından, bir kez: gösterildiği an işaretlenir,
  // kullanıcı düğmeye basmasa da bir sonraki oturumda tekrar çıkmaz.
  function offerAfterRating(totalRatings: number) {
    const offer = shouldOfferReminder({
      available: platformFeatures.reminders,
      enabled,
      offerShown,
      totalRatings,
      ratedThisSession: true,
    });
    if (offer) {
      setOfferOpen(true);
      setOfferShown(true);
    }
  }

  function permissionLost() {
    setEnabled(false);
    setDenied(true);
  }

  return {
    enabled,
    offerShown,
    denied,
    offerOpen,
    enable,
    change,
    offerAfterRating,
    closeOffer: () => setOfferOpen(false),
    permissionLost,
  };
}

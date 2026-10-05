import { useEffect } from "react";

import type { Store } from "../domain/progress";
import { toStore } from "../domain/session";

type SaveInput = Parameters<typeof toStore>[0];
type SaveSettings = Parameters<typeof toStore>[1];

/**
 * Kaydı RATE'i kovalayarak değil, ilerleme ve ayar değişimini izleyerek
 * yapıyoruz: hangi eylemin yazdırdığını bilmek gerekmiyor. Efekt ilk
 * render'da da çalışır ama yazmaz: yazıcı ilk değeri yalnızca
 * karşılaştırma noktası yapar (bkz. storeWriter.ts).
 *
 * Nesneler burada alanlarına ayrılır ve bağımlılık dizisine alanlar girer:
 * çağıran her render'da yeni bir ayar nesnesi kuruyor, nesnenin kendisi
 * bağımlılık olsaydı efekt her render'da çalışırdı.
 */
export function useSaveOnChange(
  save: (store: Store) => void,
  { progress, activeCategories, knownCategories }: SaveInput,
  {
    fastMode,
    soundEnabled,
    soundHintShown,
    hapticsEnabled,
    reminderEnabled,
    reminderOfferShown,
  }: SaveSettings,
): void {
  useEffect(() => {
    save(
      toStore(
        { progress, activeCategories, knownCategories },
        { fastMode, soundEnabled, soundHintShown, hapticsEnabled, reminderEnabled, reminderOfferShown },
      ),
    );
  }, [
    progress,
    activeCategories,
    knownCategories,
    fastMode,
    soundEnabled,
    soundHintShown,
    hapticsEnabled,
    reminderEnabled,
    reminderOfferShown,
    save,
  ]);
}

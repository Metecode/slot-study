import { useCallback, useLayoutEffect, useRef } from "react";

import { ensureAudioReady } from "../audio/audioContext";
import { playLever, playStop, playTick } from "../audio/sounds";

/* ------------------------------------------------------------------ */
/* Makine sesinin React tarafı: açık/kapalı kontrolü tek yerde         */
/*                                                                     */
/* Ses modülü React bilmiyor; burası yalnızca tercihi okuyup doğru     */
/* anda doğru fonksiyonu çağırıyor. Dönen fonksiyonlar kararlı: tercih */
/* ref'ten okunduğu için dönüş ortasında kapatılan ses hemen susar,    */
/* Drum'a giden geri çağrılar yeniden oluşmaz.                         */
/* ------------------------------------------------------------------ */

export type MachineSound = {
  /**
   * Kolun kullanıcı hareketinde (pointerup, keydown) çağrılır: context burada
   * açılır. Ses varsayılan açık olduğu için çoğu kullanıcıda ilk kilit burası.
   */
  unlock: () => void;
  /** scale: süre çarpanı (domain/spinTiming.ts soundScale). */
  lever: (scale?: number) => void;
  tick: () => void;
  stop: (scale?: number) => void;
};

export function useMachineSound(enabled: boolean): MachineSound {
  const enabledRef = useRef(enabled);
  // Render sırasında ref yazılmaz; boyamadan önce eşitlenir, tıklama
  // ya da kare geri çağrısı her zaman güncel değeri görür.
  useLayoutEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const unlock = useCallback(() => {
    if (enabledRef.current) ensureAudioReady();
  }, []);
  const lever = useCallback((scale?: number) => {
    if (enabledRef.current) playLever(scale);
  }, []);
  const tick = useCallback(() => {
    if (enabledRef.current) playTick();
  }, []);
  const stop = useCallback((scale?: number) => {
    if (enabledRef.current) playStop(scale);
  }, []);

  return { unlock, lever, tick, stop };
}

import { useLayoutEffect, useState } from "react";

import { ensureAudioReady } from "../audio/audioContext";
import { playLever } from "../audio/sounds";
import type { AnimationMode, Store } from "../domain/progress";
import { resolveAnimationMode } from "../domain/spinTiming";
import { haptics } from "../platform/haptics";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useSoundHint } from "./useSoundHint";

/* ------------------------------------------------------------------ */
/* Makine ayarları: animasyon modu, ses, titreşim                     */
/*                                                                     */
/* Ayarlar reducer'da değil, düz React state'te (bkz. session.ts        */
/* toStore). Hatırlatıcı ayrı: izin ve öneri kartıyla birlikte          */
/* useReminderSettings'te.                                             */
/* ------------------------------------------------------------------ */

export type Settings = {
  /** Kullanıcının açık seçimi; seçmediyse undefined (diske de yazılmaz). */
  animationMode: AnimationMode | undefined;
  /** Etkin mod: seçim, yoksa hareket azaltma tercihinden varsayılan. */
  effectiveAnimationMode: AnimationMode;
  setAnimationMode: (mode: AnimationMode) => void;
  soundEnabled: boolean;
  /** Ayarlar panelindeki anahtar. */
  changeSound: (enabled: boolean) => void;
  /** Makinenin hoparlör düğmesi: ses ayarı + iOS sessiz anahtar ipucu. */
  changeSpeakerSound: (enabled: boolean) => void;
  soundHintShown: boolean;
  soundHintKey: number;
  hapticsEnabled: boolean;
  changeHaptics: (enabled: boolean) => void;
};

export function useSettings(initial: Store["settings"]): Settings {
  const [animationMode, setAnimationMode] = useState(initial.animationMode);
  // Tercih oturum ortasında değişirse varsayılan da onu izler; seçim yapılmışsa etkisiz.
  const reducedMotion = usePrefersReducedMotion();
  const effectiveAnimationMode = resolveAnimationMode(animationMode, reducedMotion);
  const [soundEnabled, setSoundEnabled] = useState(initial.soundEnabled);
  const soundHint = useSoundHint(initial.soundHintShown);
  const [hapticsEnabled, setHapticsEnabled] = useState(initial.hapticsEnabled);

  // Haptik modülü tercihi kendisi tutuyor, çağrı noktalarına ayar inmiyor.
  // Boyamadan önce eşitlenir: tıklama her zaman güncel değeri görür.
  useLayoutEffect(() => {
    haptics.setEnabled(hapticsEnabled);
  }, [hapticsEnabled]);

  /*
    Ses açılırken context de açılır: bu fonksiyon tıklamanın içinde
    çalışıyor, yani tarayıcının istediği kullanıcı hareketi tam burada.
    Açık kayıtla gelen kullanıcıda ilk kol çekişi aynı işi görür.
    Kol sesi onay olarak çalar: hem "ses açıldı" geri bildirimi (duymayan
    kullanıcı sorunu hemen fark eder) hem de iOS'ta kilidi en güvenilir
    açan yol — hareketin içinde gerçekten ses çalmak. Tık bunun için fazla
    kısa ve kısıktı.
  */
  function changeSound(enabled: boolean) {
    if (enabled) {
      ensureAudioReady();
      playLever();
    }
    setSoundEnabled(enabled);
  }

  // Açılınca bir kez titreşir: ses açılınca kol sesinin çalmasının karşılığı.
  function changeHaptics(enabled: boolean) {
    if (enabled) haptics.switchedOn();
    setHapticsEnabled(enabled);
  }

  // Sessiz anahtar ipucu yalnızca hoparlör düğmesinde: ipucu onun yanında
  // çıkıyor. Ayarlar panelindeki anahtarın altında kalıcı not zaten var.
  function changeSpeakerSound(enabled: boolean) {
    changeSound(enabled);
    if (enabled) soundHint.noteSoundEnabled();
  }

  return {
    animationMode,
    effectiveAnimationMode,
    setAnimationMode,
    soundEnabled,
    changeSound,
    changeSpeakerSound,
    soundHintShown: soundHint.hintShown,
    soundHintKey: soundHint.hintKey,
    hapticsEnabled,
    changeHaptics,
  };
}

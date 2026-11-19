import { useState } from "react";

import type { AnimationMode } from "../domain/progress";
import { IS_APPLE_TOUCH_DEVICE } from "../hooks/useSoundHint";
import { platformFeatures } from "../platform";
import { ChevronIcon } from "./ChevronIcon";
import { Collapse } from "./Collapse";
import { ReminderSetting } from "./ReminderSetting";
import { SegmentedControl } from "./SegmentedControl";
import type { SegmentedOption } from "./SegmentedControl";
import { Switch } from "./Switch";
import { UsageStatsSetting } from "./UsageStatsSetting";
import styles from "./SettingsPanel.module.css";

/* ------------------------------------------------------------------ */
/* Makinenin ayarları — varsayılan kapalı, tek satırlık özet            */
/* ------------------------------------------------------------------ */

/*
  Makineye ait ayarlar, soruya değil: yeri makinenin hemen altı.
  Değerler ve kararlar App'te (useSettings, useReminderSettings); panel
  yalnızca açık/kapalı durumunu kendisi tutar, o da diske yazılmaz.
*/

/**
 * Dönüş animasyonu. Kısa: oturumun ilk çekişi tam, sonrakiler kısa.
 * Kapalı: tamburlar sonuca anında gelir. Süreler domain/spinTiming.ts'te.
 */
const ANIMATION_OPTIONS: readonly SegmentedOption<AnimationMode>[] = [
  { value: "full", label: "Tam" },
  { value: "short", label: "Kısa" },
  { value: "off", label: "Kapalı" },
];

export type SettingsPanelProps = {
  /** Etkin mod: seçim yoksa hareket azaltma tercihinden gelen varsayılan. */
  animationMode: AnimationMode;
  onAnimationModeChange: (mode: AnimationMode) => void;
  soundEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  hapticsEnabled: boolean;
  onHapticsChange: (enabled: boolean) => void;
  reminderEnabled: boolean;
  onReminderChange: (enabled: boolean) => void;
  /** İzin verilmedi ya da sistemden kaldırıldı. */
  reminderDenied: boolean;
  /** Ölçüm bu derlemede mümkün değilse anahtar çizilmez. */
  usageAvailable: boolean;
  usageEnabled: boolean;
  onUsageChange: (enabled: boolean) => void;
  /**
   * Değiştikçe panel açılır ve odak kullanım anahtarına gelir (bilgilendirme
   * kartındaki "Ayarlar"). 0: istek yok.
   */
  openRequest: number;
};

export function SettingsPanel({
  animationMode,
  onAnimationModeChange,
  soundEnabled,
  onSoundChange,
  hapticsEnabled,
  onHapticsChange,
  reminderEnabled,
  onReminderChange,
  reminderDenied,
  usageAvailable,
  usageEnabled,
  onUsageChange,
  openRequest,
}: SettingsPanelProps) {
  // Varsayılan kapalı — kimse ayar aramak zorunda kalmasın.
  const [open, setOpen] = useState(false);
  /*
    Yeni istek render sırasında işlenir (efektte değil): panelin açılması
    ve odak isteği aynı commit'e düşer, anahtar odağı panel açık çizildikten
    sonra alır. Odak önce inseydi içerik hâlâ inert olurdu (Collapse).
  */
  const [focusRequest, setFocusRequest] = useState(openRequest);
  if (openRequest !== focusRequest) {
    setFocusRequest(openRequest);
    setOpen(true);
  }

  return (
    <div className={styles.settings}>
      <button
        type="button"
        className={styles.settingsToggle}
        aria-expanded={open}
        aria-controls="settings-panel"
        onClick={() => setOpen((value) => !value)}
      >
        Ayarlar
        <ChevronIcon className={styles.chevron} />
      </button>

      <Collapse open={open} id="settings-panel">
        <div className={styles.controls}>
          <SegmentedControl
            label="Animasyon"
            options={ANIMATION_OPTIONS}
            value={animationMode}
            onChange={onAnimationModeChange}
          />
          <span className={styles.soundControl}>
            <Switch
              checked={soundEnabled}
              onChange={onSoundChange}
              label="Ses"
              describedBy={IS_APPLE_TOUCH_DEVICE ? "silent-switch-note" : undefined}
            />
            {/* Web'den sessiz anahtar okunamıyor; iOS'ta kalıcı hatırlatma. */}
            {IS_APPLE_TOUCH_DEVICE && (
              <span id="silent-switch-note" className={styles.settingsNote}>
                iPhone sessiz moddayken ses çalmaz.
              </span>
            )}
          </span>
          {platformFeatures.haptics && (
            <Switch checked={hapticsEnabled} onChange={onHapticsChange} label="Titreşim" />
          )}
          {platformFeatures.reminders && (
            <ReminderSetting
              checked={reminderEnabled}
              onChange={onReminderChange}
              denied={reminderDenied}
            />
          )}
          {usageAvailable && (
            <UsageStatsSetting checked={usageEnabled} onChange={onUsageChange} focusRequest={focusRequest} />
          )}
        </div>
      </Collapse>
    </div>
  );
}

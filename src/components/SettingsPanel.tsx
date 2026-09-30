import { useState } from "react";

import { IS_APPLE_TOUCH_DEVICE } from "../hooks/useSoundHint";
import { platformFeatures } from "../platform";
import { ChevronIcon } from "./ChevronIcon";
import { Collapse } from "./Collapse";
import { ReminderSetting } from "./ReminderSetting";
import { Switch } from "./Switch";
import styles from "./SettingsPanel.module.css";

/* ------------------------------------------------------------------ */
/* Makinenin ayarları — varsayılan kapalı, tek satırlık özet            */
/* ------------------------------------------------------------------ */

/*
  Makineye ait ayarlar, soruya değil: yeri makinenin hemen altı.
  Değerler ve kararlar App'te (useSettings, useReminderSettings); panel
  yalnızca açık/kapalı durumunu kendisi tutar, o da diske yazılmaz.
*/

export type SettingsPanelProps = {
  fastMode: boolean;
  onFastModeChange: (enabled: boolean) => void;
  soundEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  hapticsEnabled: boolean;
  onHapticsChange: (enabled: boolean) => void;
  reminderEnabled: boolean;
  onReminderChange: (enabled: boolean) => void;
  /** İzin verilmedi ya da sistemden kaldırıldı. */
  reminderDenied: boolean;
};

export function SettingsPanel({
  fastMode,
  onFastModeChange,
  soundEnabled,
  onSoundChange,
  hapticsEnabled,
  onHapticsChange,
  reminderEnabled,
  onReminderChange,
  reminderDenied,
}: SettingsPanelProps) {
  // Varsayılan kapalı — kimse ayar aramak zorunda kalmasın.
  const [open, setOpen] = useState(false);

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
          <Switch checked={fastMode} onChange={onFastModeChange} label="Hızlı mod" />
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
        </div>
      </Collapse>
    </div>
  );
}

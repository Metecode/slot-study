/// <reference types="vite/client" />

/** vite.config.ts'te package.json'dan enjekte edilir. */
declare const __APP_VERSION__: string;

/** Commit'in ilk 7 karakteri; dev sunucusunda "dev", kaynak yoksa boş (build-info/commitLabel.ts). */
declare const __COMMIT_SHA__: string;

interface ImportMetaEnv {
  /**
   * Yalnızca cihaz testi: tanımlıysa tekrar hatırlatıcısı hesabı atlanır,
   * bildirim her kurulumda N saniye sonraya kurulur (bkz. useReviewReminder).
   */
  readonly VITE_REMINDER_TEST_SECONDS?: string;
  /**
   * Native'in API kökü (ör. https://slot.meteucar.com). Web okumaz, göreli
   * yol kullanır. Tanımsızsa native'de kullanım ölçümü kapalıdır
   * (bkz. platform/index.ts analyticsTarget).
   */
  readonly VITE_API_BASE_URL?: string;
}

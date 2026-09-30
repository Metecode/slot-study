/// <reference types="vite/client" />

/** vite.config.ts'te package.json'dan enjekte edilir. */
declare const __APP_VERSION__: string;

/** vite.config.ts'te GITHUB_SHA'nın ilk 7 karakteri; yerelde "dev". */
declare const __COMMIT_SHA__: string;

interface ImportMetaEnv {
  /**
   * Yalnızca cihaz testi: tanımlıysa tekrar hatırlatıcısı hesabı atlanır,
   * bildirim her kurulumda N saniye sonraya kurulur (bkz. useReviewReminder).
   */
  readonly VITE_REMINDER_TEST_SECONDS?: string;
}

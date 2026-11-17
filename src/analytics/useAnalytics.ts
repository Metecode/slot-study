import { useCallback, useEffect, useRef, useState } from "react";

import type { QuestionProgress } from "../domain/progress";
import type { Category, Question } from "../domain/question";
import { dueCountOf } from "../domain/usageMetrics";
import { analytics } from "./analytics";
import type { Consent } from "./analyticsStorage";
import { shouldShowUsageNotice } from "./usageNotice";

/* ------------------------------------------------------------------ */
/* Kullanım ölçümünün React tarafı                                     */
/* ------------------------------------------------------------------ */

/*
  app_open: açılışta bir kez ve en az 30 dakika arka planda kaldıktan sonra
  ön plana dönüşte. Gönderim: açılış, arka plana geçiş ve 60 sn'lik aralık.

  "Bir kez" güvencesi modül seviyesinde, hook'ta değil: StrictMode efektleri
  iki kez çalıştırıyor (progressSync ile aynı gerekçe).

  Arka plan algılama web'de ve native'de visibilitychange: Capacitor
  uygulama arka plana geçince WebView'de de tetikliyor (hatırlatıcı da
  buna dayanıyor).
*/

export const FLUSH_INTERVAL_MS = 60_000;
export const RESUME_AFTER_MS = 30 * 60_000;

let launchStarted = false;
let hiddenAt: number | null = null;

type DueSource = {
  progress: Readonly<Record<string, QuestionProgress>>;
  questions: readonly Question[];
  activeCategories: readonly Category[];
};

function trackAppOpen({ progress, questions, activeCategories }: DueSource): void {
  try {
    const dueCount = Math.min(dueCountOf(progress, questions, activeCategories, new Date()), 10_000);
    analytics.track({ name: "app_open", props: { dueCount } });
  } catch {
    // Ölçüm uygulamayı bozmaz.
  }
}

export type AnalyticsSettings = {
  /** Bu derlemede ölçüm mümkün mü; değilse anahtar da kart da çizilmez. */
  available: boolean;
  /** Ayarlar'daki anahtar; tercih okunana kadar false. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** İlk açılış bilgilendirmesi bu oturumda açık mı. */
  noticeOpen: boolean;
  closeNotice: () => void;
};

export function useAnalytics(source: DueSource): AnalyticsSettings {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  // Arka plandan dönüşte o anki ilerleme ve seçim gerekiyor; efekt yeniden kurulmasın.
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });

  useEffect(() => {
    let cancelled = false;
    void analytics.load().then((loaded) => {
      if (!cancelled) {
        setConsent(loaded);
        // Gösterildiği an kaydedilir: kapatılmasa da bir daha çıkmaz.
        if (shouldShowUsageNotice(loaded, analytics.available)) {
          setNoticeOpen(true);
          void analytics.markNoticeShown();
        }
      }
      if (launchStarted) return;
      launchStarted = true;
      trackAppOpen(sourceRef.current);
      void analytics.flush();
    });

    const interval = window.setInterval(() => void analytics.flush(), FLUSH_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        void analytics.flush({ keepalive: true });
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= RESUME_AFTER_MS) {
        trackAppOpen(sourceRef.current);
      }
      hiddenAt = null;
      void analytics.flush();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    void analytics.setEnabled(enabled);
    setConsent(analytics.consent());
  }, []);

  const closeNotice = useCallback(() => setNoticeOpen(false), []);

  return {
    available: analytics.available,
    enabled: consent?.enabled ?? false,
    setEnabled,
    noticeOpen,
    closeNotice,
  };
}

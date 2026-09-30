import { useEffect, useEffectEvent } from "react";

import type { QuestionProgress } from "../domain/progress";
import type { Category, Question } from "../domain/question";
import { nextReminderAt } from "../domain/reminder";
import { platformFeatures } from "../platform";
import { reminders } from "../platform/reminders";

/* ------------------------------------------------------------------ */
/* Tekrar hatırlatıcısının React tarafı: ne zaman yeniden kurulacak     */
/*                                                                     */
/* Karar domain/reminder.ts'te, bildirim platform/reminders.ts'te;      */
/* burası yalnızca tetikleri bağlıyor. Web'de hiçbir şey yapmaz.        */
/* ------------------------------------------------------------------ */

type ReviewReminderInput = {
  enabled: boolean;
  progress: Readonly<Record<string, QuestionProgress>>;
  questions: readonly Question[];
  activeCategories: readonly Category[];
  /** İzin sistemden kaldırılmış; App anahtarı kapatıp açıklamayı gösterir. */
  onPermissionLost: () => void;
};

/**
 * Cihaz testi için: derleme anında VITE_REMINDER_TEST_SECONDS verilirse
 * hesap atlanır ve bildirim her kurulumda şimdiden N saniye sonraya
 * kurulur. Tanımsızken sabit undefined; dal derlemede tamamen düşer.
 */
const TEST_DELAY_SECONDS = Number(import.meta.env.VITE_REMINDER_TEST_SECONDS ?? 0);

function plan(input: Omit<ReviewReminderInput, "enabled" | "onPermissionLost">): Date | null {
  const now = new Date();
  if (TEST_DELAY_SECONDS > 0) return new Date(now.getTime() + TEST_DELAY_SECONDS * 1000);
  return nextReminderAt({ now, ...input });
}

export function useReviewReminder({
  enabled,
  progress,
  questions,
  activeCategories,
  onPermissionLost,
}: ReviewReminderInput): void {
  const active = platformFeatures.reminders && enabled;

  // Ayar kapalıyken bir kez iptal: ilerleme değiştikçe tekrar tekrar
  // eklentiye gitmesin.
  useEffect(() => {
    if (!platformFeatures.reminders || enabled) return;
    void reminders.sync(null);
  }, [enabled]);

  // Kayıttan (RATE), kategori değişiminden ve açılıştan sonra yeniden kur.
  useEffect(() => {
    if (!active) return;
    void reminders.sync(plan({ progress, questions, activeCategories }));
  }, [active, progress, questions, activeCategories]);

  /*
    Arka plana geçerken yeniden kur: ertesi gün kuralı "bugün"e bağlı,
    uygulama gün değişirken açık kaldıysa hesap eskidi. Öne gelince izin
    kontrol edilir; kullanıcı izni sistemden kaldırmış olabilir.
  */
  const onHidden = useEffectEvent(() => {
    if (!active) return;
    void reminders.sync(plan({ progress, questions, activeCategories }));
  });
  const checkPermission = useEffectEvent(async () => {
    if (!active) return;
    if ((await reminders.checkPermission()) === "denied") onPermissionLost();
  });

  useEffect(() => {
    if (!platformFeatures.reminders) return;
    void checkPermission();

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") onHidden();
      else void checkPermission();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
}

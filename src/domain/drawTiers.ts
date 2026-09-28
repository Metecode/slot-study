import { dueAtOf } from "./leitner";
import type { QuestionProgress } from "./progress";
import type { Question } from "./question";
import { studyDayStart } from "./studyDay";

/* ------------------------------------------------------------------ */
/* Çekiliş katmanları — hangi sorular aday                              */
/* ------------------------------------------------------------------ */

/*
  Zamanı gelen soru önce gelir. Eski ağırlıklarda yeni soru (20), kutu
  1'de zamanı gelmiş sorunun (16) önündeydi ve zamanı gelmemiş soru da
  zamanı gelmiş kadar ağırdı: günde 10 turda yeni sorular kapasitenin
  üstünde tanıtılıyor, tekrarlar birikip günlerce gecikiyordu (100 soruluk
  simülasyonda 30. günde 65 soru, ortalama 6.5 gün gecikmeli).

  Sıra:
  1. Zamanı gelmiş soru varsa adaylar onlar. Yanlarına bir çalışma gününde
     en fazla NEW_PER_DAY_WHILE_DUE yeni soru katılır: birikim varken de
     yeni içerik tamamen durmasın.
  2. Zamanı gelmiş yoksa yeni sorular, sınırsız.
  3. İkisi de yoksa zamanı gelmemişler (yedek). Soru döndürmemek bir
     seçenek değil; yedek ağırlık zamanına yakın olanı öne çıkarır, az önce
     görüleni geri plana iter (bkz. draw.ts notDueWeightOf).

  Soğutma (son sorulanlar) katmanlardan önce, drawQuestion'da uygulanır.
  Katman içindeki ağırlıklar ve seçim draw.ts'te.
*/

/** Zamanı gelmiş soru varken bir çalışma gününde tanıtılabilecek yeni soru. */
export const NEW_PER_DAY_WHILE_DUE = 1;

/**
 * Soru şu an tekrar edilmeli mi: tekrar günü geldi mi (yerel 04:00, bkz.
 * dueAt)?
 *
 * Tarihi okunamayan, ileri tarihli (lastSeenAt şimdiden sonra: cihaz saati
 * kaymış) ya da kutusu aralık tablosu dışında kalan kayıt da zamanı gelmiş
 * sayılır: gösterilir, değerlendirilir ve kaydı düzelir. Geri planda
 * bekletilse bozuk kayıt kendiliğinden düzelmezdi.
 */
export function isDue(progress: QuestionProgress, now: Date): boolean {
  const seenAt = Date.parse(progress.lastSeenAt);
  if (!Number.isFinite(seenAt) || seenAt > now.getTime()) return true;

  const due = dueAtOf(progress)?.getTime();
  if (due === undefined || !Number.isFinite(due)) return true;

  return due <= now.getTime();
}

/**
 * Bu çalışma gününde tanıtılan yeni soru sayısı: ilk denemesi bugün olan
 * kayıtlar. Oturumda ayrı bir sayaç tutulmuyor, ilerlemeden türetiliyor:
 * sayfa yenilense de, soru başka cihazda tanıtılıp senkronla gelse de doğru
 * sayar.
 *
 * Kayıtta yalnızca son MAX_ATTEMPTS deneme tutulur; en eskisi ilk deneme
 * sayılır. Yanılabileceği tek durum bir soruyu bir günde MAX_ATTEMPTS'ten
 * fazla denemek; sonucu o gün bir yeni sorunun daha az gelmesi.
 */
export function introducedToday(
  progress: Readonly<Record<string, QuestionProgress>>,
  now: Date,
): number {
  const dayStart = studyDayStart(now).getTime();
  let count = 0;
  for (const entry of Object.values(progress)) {
    const first = entry.attempts[0];
    if (first && Date.parse(first.at) >= dayStart) count++;
  }
  return count;
}

export type Candidates = {
  /** Havuz sırasında adaylar; kümülatif seçim bu sırayla yapılır. */
  questions: Question[];
  /** Yalnızca zamanı gelmemişler kaldı: yedek ağırlıkla tartılır. */
  fallback: boolean;
};

/**
 * Soğutmadan sonraki havuzdan bu turun adayları. Havuz boş değilse aday
 * listesi de boş olmaz: son katman havuzun tamamıdır.
 */
export function candidatesOf(
  pool: readonly Question[],
  progress: Readonly<Record<string, QuestionProgress>>,
  now: Date,
): Candidates {
  const due = pool.filter((q) => {
    const entry = progress[q.id];
    return entry !== undefined && isDue(entry, now);
  });
  const unseen = pool.filter((q) => progress[q.id] === undefined);

  if (due.length > 0) {
    const allowNew = introducedToday(progress, now) < NEW_PER_DAY_WHILE_DUE;
    const chosen = new Set(allowNew ? [...due, ...unseen] : due);
    // Havuz sırası korunur: aynı rng aynı soruyu versin.
    return { questions: pool.filter((q) => chosen.has(q)), fallback: false };
  }
  if (unseen.length > 0) return { questions: unseen, fallback: false };
  return { questions: [...pool], fallback: true };
}

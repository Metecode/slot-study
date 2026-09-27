import { dueAtOf } from "./leitner";
import type { QuestionProgress } from "./progress";
import type { Category, Question } from "./question";

/* ------------------------------------------------------------------ */
/* Tekrar hatırlatıcısı — ne zaman ve kime                             */
/* ------------------------------------------------------------------ */

/*
  Bildirimin kendisi platform katmanında (src/platform/reminders.ts);
  burada yalnızca karar var: saat, tarih ve öneri kartı.

  Bildirim "tekrar zamanı gelmiş soru var" demek için kurulur ama
  çekilişin o soruları göstereceğini vaat etmez: çekiliş zamanı gelmemiş
  soruyu da seçebiliyor (bkz. draw.ts). Metin bu yüzden genel.
*/

/** Hatırlatıcının çaldığı yerel saat. Sabit; ayar yok. */
export const REMINDER_HOUR = 19;

/** Ayar anahtarının altındaki açıklama. */
export const REMINDER_DESCRIPTION = `Tekrar zamanı gelen soru olduğunda akşam ${REMINDER_HOUR}:00'da bir kez hatırlatır.`;

/**
 * İzin verilmediğinde ya da sistemden kaldırıldığında. Eklentinin sistem
 * ayarlarını açan bir API'si yok; yol metinle tarif ediliyor.
 */
export const REMINDER_DENIED_NOTE = "Bildirim izni kapalı. Ayarlar › Uygulamalar › Slot › Bildirimler'den açabilirsin.";

/** Öneri kartı bu kadar değerlendirmeden sonra çıkar. */
export const REMINDER_OFFER_AFTER_RATINGS = 5;

export type ReminderInput = {
  now: Date;
  progress: Readonly<Record<string, QuestionProgress>>;
  questions: readonly Question[];
  /** Yalnızca seçili kategorilerdeki sorular sayılır; çekiliş de onlardan yapıyor. */
  activeCategories: readonly Category[];
};

/**
 * Bir sonraki hatırlatmanın zamanı; hatırlatacak bir şey yoksa null.
 *
 * 1. Seçili kategorilerde, içerikte hâlâ var olan ve tarihi okunabilen
 *    kayıtların en erken tekrar zamanı bulunur.
 * 2. Ertesi gün kuralı: bugün uygulamayı açan kullanıcıya bugün
 *    hatırlatılmaz. Zamanlama hep uygulama açıkken yapıldığı için "bugün"
 *    kullanıcının son kullandığı gün.
 * 3. Bu ikisinden sonraki ilk yerel REMINDER_HOUR seçilir.
 *
 * Saat yerel takvimle kurulur, 24 saat eklenerek değil: yaz saati
 * geçişinde 19:00 18:00'e ya da 20:00'ye kaymasın.
 */
export function nextReminderAt({ now, progress, questions, activeCategories }: ReminderInput): Date | null {
  const active = new Set(activeCategories);

  let earliest: number | null = null;
  for (const question of questions) {
    if (!active.has(question.category)) continue;
    const entry = progress[question.id];
    if (!entry) continue;
    const due = dueAtOf(entry);
    if (!due) continue;
    if (earliest === null || due.getTime() < earliest) earliest = due.getTime();
  }
  if (earliest === null) return null;

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const notBefore = new Date(Math.max(earliest, tomorrow.getTime()));

  const sameDay = atReminderHour(notBefore, 0);
  return sameDay.getTime() >= notBefore.getTime() ? sameDay : atReminderHour(notBefore, 1);
}

/** Verilen günün (artı gün farkının) yerel REMINDER_HOUR'u. */
function atReminderHour(day: Date, dayOffset: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + dayOffset, REMINDER_HOUR);
}

export type ReminderOfferInput = {
  /** Platform hatırlatıcıyı destekliyor mu (native). */
  available: boolean;
  enabled: boolean;
  offerShown: boolean;
  /** Tüm sorulardaki toplam değerlendirme. */
  totalRatings: number;
  /**
   * Bu oturumda en az bir değerlendirme yapıldı mı? Kart bir değerlendirmenin
   * ardından çıkar; eşiği çoktan geçmiş kullanıcı da uygulamayı açar açmaz
   * değil, bir sonraki turu bitirince görür.
   */
  ratedThisSession: boolean;
};

/** Hatırlatıcı öneri kartı gösterilsin mi? Tek sefer, dayatmadan. */
export function shouldOfferReminder({
  available,
  enabled,
  offerShown,
  totalRatings,
  ratedThisSession,
}: ReminderOfferInput): boolean {
  return (
    available &&
    !enabled &&
    !offerShown &&
    ratedThisSession &&
    totalRatings >= REMINDER_OFFER_AFTER_RATINGS
  );
}

/**
 * Tüm ilerlemedeki değerlendirme sayısı. Soru başına yalnızca son
 * MAX_ATTEMPTS deneme tutulduğu için gerçek sayının alt sınırı; eşik için yeter.
 */
export function countRatings(progress: Readonly<Record<string, QuestionProgress>>): number {
  let total = 0;
  for (const entry of Object.values(progress)) total += entry.attempts.length;
  return total;
}

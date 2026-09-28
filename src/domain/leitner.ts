import type { Attempt, Box, QuestionProgress, SelfRating } from "./progress";
import { studyDayAfter, studyDaysBetween } from "./studyDay";

/* ------------------------------------------------------------------ */
/* Leitner — kutu geçişi ve deneme kaydı                               */
/* ------------------------------------------------------------------ */

/**
 * Kutu 1..5 için tekrar aralığı, gün cinsinden. Dizin = kutu - 1.
 * Kutu yükseldikçe soru seyrekleşir; çekiliş ağırlığı bu aralığa bakar.
 */
export const BOX_INTERVALS_DAYS = [1, 2, 4, 8, 16] as const;

/** Tavan kutu. Buradan yukarısı yok. */
export const MAX_BOX: Box = 5;

/** Tutulan deneme sayısı. Şemadaki `attempts` üst sınırıyla aynı olmalı. */
export const MAX_ATTEMPTS = 10;

/**
 * Bir denemeden sonra sorunun gideceği kutu.
 * Kararı kullanıcının öz-değerlendirmesi verir, makine skoru değil.
 */
export function nextBox(
  currentBox: Box,
  rating: SelfRating,
  passed: boolean,
): Box {
  // Pas geçmek "bilmiyordum" ile aynı sonucu verir: soru en başa döner.
  if (passed || rating === 0) return 1;

  // Kısmen bilindi — kutu korunur, aralık değişmez.
  if (rating === 1) return currentBox;

  // Bilindi — bir kutu ilerler, ama tavanı aşmaz.
  return Math.min(currentBox + 1, MAX_BOX) as Box;
}

/* ------------------------------------------------------------------ */
/* Tekrar zamanı — "Sonraki tekrar" metinleri ve hatırlatıcı buradan    */
/* ------------------------------------------------------------------ */

/**
 * Sorunun tekrar zamanı: görüldüğü çalışma gününden kutunun aralığı kadar
 * sonraki çalışma gününün başı (yerel 04:00, bkz. studyDay.ts). Aralık
 * saatle değil takvim günüyle sayılır: kutu 1'de 20:30'da görülen soru
 * ertesi gün 04:00'dan itibaren gelmiştir, ertesi akşam 20:30'u beklemez.
 * "Yarın" dediğimiz gün, kullanıcı o gün hangi saatte açarsa açsın gelmiş
 * olur.
 *
 * Kullanıcıya söylenen gün ve hatırlatıcı buna dayanıyor.
 */
export function dueAt(box: Box, seenAt: Date): Date {
  return studyDayAfter(seenAt, BOX_INTERVALS_DAYS[box - 1]);
}

/** Kayıttan tekrar zamanı; lastSeenAt okunamıyorsa null. */
export function dueAtOf(progress: Pick<QuestionProgress, "box" | "lastSeenAt">): Date | null {
  const seenAt = Date.parse(progress.lastSeenAt);
  if (!Number.isFinite(seenAt)) return null;
  return dueAt(progress.box, new Date(seenAt));
}

/**
 * Metinler için tekrara kalan gün: görüldüğü çalışma günü ile tekrar
 * gününün farkı. Fark görülme anına bağlı değil, bu yüzden sabit bir çapa
 * yeter: arayüz "şimdi"yi bilmeden aynı sayıyı dueAt'ten okur, gün sayısı
 * ile hatırlatıcı ayrışmaz.
 */
const LABEL_ANCHOR = new Date(0);

function daysUntilDue(box: Box): number {
  return studyDaysBetween(LABEL_ANCHOR, dueAt(box, LABEL_ANCHOR));
}

/* ------------------------------------------------------------------ */
/* Aşama — kutunun kullanıcıya gösterilen adı                          */
/*                                                                     */
/* Kodda kavramın adı box olarak kalır; "Kutu N" yalnızca arayüzden     */
/* kalkar. Kullanıcı için anlamlı olan kutunun numarası değil, soruyu   */
/* ne kadar oturttuğu.                                                  */
/* ------------------------------------------------------------------ */

export type StageName = "Yeni" | "Öğreniliyor" | "Pekişiyor" | "İyi biliniyor" | "Oturdu";

export type Stage = {
  /** Dolu nokta sayısı; kutuyla birebir. */
  level: Box;
  name: StageName;
};

/** Aşama rozetindeki toplam nokta sayısı. */
export const STAGE_COUNT = MAX_BOX;

/**
 * Kutu ve deneme sayısından aşama. Kutu 1 iki aşamaya ayrılır: hiç
 * denenmemiş soru "Yeni", denenip kutu 1'de kalmış (ya da oraya
 * düşmüş) soru "Öğreniliyor" — ikisi aynı kutuda ama kullanıcı için
 * farklı durumlar.
 */
export function stageOf(box: Box, attemptCount: number): Stage {
  switch (box) {
    case 1:
      return { level: 1, name: attemptCount > 0 ? "Öğreniliyor" : "Yeni" };
    case 2:
      return { level: 2, name: "Öğreniliyor" };
    case 3:
      return { level: 3, name: "Pekişiyor" };
    case 4:
      return { level: 4, name: "İyi biliniyor" };
    case 5:
      return { level: 5, name: "Oturdu" };
  }
}

/** Tek gün "1 gün sonra" değil "yarın" diye yazılır. */
function daysAheadText(days: number): string {
  return days === 1 ? "yarın" : `${days} gün sonra`;
}

/**
 * Sorunun şu anki kutusuna göre bir sonraki tekrarı. Sonuç ekranının
 * alt çubuğu bunu yazar: sıklığı ("4 günde bir") değil, ne zaman
 * döneceğini söyler.
 */
export function nextReviewInLabel(box: Box): string {
  return `Sonraki tekrar: ${daysAheadText(daysUntilDue(box))}`;
}

/**
 * Bir öz-değerlendirme seçilirse sorunun bir sonraki tekrarı kaç gün
 * sonraya düşer. Düğmelerin altındaki gün sayısı buradan geliyor.
 *
 * Hesap doğrudan aralık tablosundan okunmaz, nextBox ve dueAt üzerinden yapılır:
 * ekranda yazan gün ile sorunun gerçekten gideceği kutu ayrışmasın.
 * Kutu 1'de "biliyordum" kutu 2'ye taşır, yani 2 gün — tablodan sabit
 * bir sayı okunsaydı bu ilişki ilk kutu değişikliğinde bozulurdu.
 */
export function reviewIntervalDays(
  currentBox: Box,
  rating: SelfRating,
  passed = false,
): number {
  return daysUntilDue(nextBox(currentBox, rating, passed));
}

/**
 * Öz-değerlendirme düğmesinin alt yazısı: yalnızca ne zaman döneceği
 * ("2 gün sonra", "yarın").
 *
 * Önceden hedef aşama da yazıyordu ("Öğreniliyor · yarın"); üç düğmede
 * çoğu zaman aynı aşama adı tekrar ettiği için gürültüydü. Aşama
 * değişikliği artık seçimden SONRA, ratingSavedLabel ile gösteriliyor.
 */
export function reviewWhenLabel(
  currentBox: Box,
  rating: SelfRating,
  passed = false,
): string {
  return daysAheadText(reviewIntervalDays(currentBox, rating, passed));
}

/** Aşama adının yönelme hâli; ünlü uyumu ve kaynaştırma harfi elle. */
const STAGE_DATIVE: Record<StageName, string> = {
  Yeni: "Yeni'ye",
  Öğreniliyor: "Öğreniliyor'a",
  Pekişiyor: "Pekişiyor'a",
  "İyi biliniyor": "İyi biliniyor'a",
  Oturdu: "Oturdu'ya",
};

/**
 * Seçim yapıldıktan sonra düğmelerin altında beliren satır:
 * "Kaydedildi · 2 gün sonra tekrar" ya da aşama yükseldiyse
 * "Pekişiyor'a çıktı · 4 gün sonra tekrar".
 *
 * "Yükseldi" iki şartla sayılır: kutu ilerledi VE aşama adı değişti.
 * Kutu 1'den 2'ye geçen soru iki kutuda da "Öğreniliyor" — adı aynı
 * kalan bir aşamaya "çıktı" demek yanıltıcı olurdu.
 *
 * Yeni aşama stageOf'a deneme sayısı 1 verilerek bulunur: değerlendirme
 * kaydedildiği anda soru en az bir kez denenmiş olur.
 */
export function ratingSavedLabel(
  currentBox: Box,
  attemptCount: number,
  rating: SelfRating,
  passed = false,
): string {
  const targetBox = nextBox(currentBox, rating, passed);
  const when = `${reviewWhenLabel(currentBox, rating, passed)} tekrar`;

  const from = stageOf(currentBox, attemptCount);
  const to = stageOf(targetBox, 1);
  const promoted = targetBox > currentBox && to.name !== from.name;

  return promoted ? `${STAGE_DATIVE[to.name]} çıktı · ${when}` : `Kaydedildi · ${when}`;
}

/**
 * Denemeyi ilerlemeye işler.
 * Saf: gelen nesneyi değiştirmez, yeni bir kayıt döner.
 */
export function applyAttempt(
  progress: QuestionProgress,
  attempt: Attempt,
): QuestionProgress {
  return {
    ...progress,
    box: nextBox(progress.box, attempt.selfRating, attempt.passed),
    // Zaman dışarıdan gelir; burada Date.now() çağrılmaz.
    lastSeenAt: attempt.at,
    // Son MAX_ATTEMPTS kayıt tutulur, eskiler baştan düşer.
    attempts: [...progress.attempts, attempt].slice(-MAX_ATTEMPTS),
  };
}

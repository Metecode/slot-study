import { candidatesOf } from "./drawTiers";
import { BOX_INTERVALS_DAYS, MAX_BOX } from "./leitner";
import type { QuestionProgress } from "./progress";
import type { Category, Question } from "./question";

/* ------------------------------------------------------------------ */
/* Çekiliş — kazanan animasyondan önce burada belirlenir               */
/*                                                                     */
/* Önce hangi soruların aday olduğu (drawTiers.ts: zamanı gelmiş >      */
/* yeni > zamanı gelmemiş), sonra adaylar arasında ağırlıklı seçim.     */
/* ------------------------------------------------------------------ */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Hiç sorulmamış sorunun sabit ağırlığı. Zamanı gelmiş sorularla aynı
 * katmana girdiğinde (günde bir kez, bkz. drawTiers.ts) kutu 1'deki zamanı
 * gelmiş sorudan (16) biraz ağır; iyice gecikmiş sorular (48'e kadar) onu
 * geçebilir.
 */
export const NEW_QUESTION_WEIGHT = 20;

/** Gecikme katsayısının alt ve üst sınırı. */
const MIN_OVERDUE = 1;
const MAX_OVERDUE = 3;

/**
 * Yedek ağırlıktaki oranın alt sınırı. Karesi 0.0001: az önce görülmüş
 * soru, aynı kutuda zamanı gelmek üzere olan sorudan 10.000 kat seyrek
 * gelir ama hiçbir zaman sıfır ağırlık almaz; havuz ne olursa olsun toplam
 * sıfırdan büyük kalır.
 *
 * 0.1 de denendi: 13 soruluk havuzda, günde 10 turda aynı gün tekrar
 * günde 1.7'ye çıkıyordu (0.01'de 0.2). Az önce görülen kutu 1 sorusu
 * (16 × 0.01) dün görülmüş kutu 3 sorusuyla (≈0.25) yarışıyordu.
 */
export const FALLBACK_MIN_RATIO = 0.01;

/** Arka arkaya aynı soruyu görmemek için elenen son soru sayısı. */
export const COOLDOWN_SIZE = 3;

/**
 * Sonlu olmayan değer tabana çekilir.
 * NaN sessiz bir zehirdir: `total <= 0` kontrolüne yakalanmaz, kümülatif
 * toplamı bozar ve çekiliş farkına varılmadan hep son soruyu döndürmeye
 * başlar. Bozuk veri en fazla ağırlığı yanlış yapsın, seçimi kilitlemesin.
 */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Görülmeden bu yana geçen süre, kutunun aralığına oranla; okunamazsa NaN. */
function elapsedRatio(progress: QuestionProgress, now: Date): number {
  const interval = BOX_INTERVALS_DAYS[progress.box - 1];
  const elapsedDays = (now.getTime() - Date.parse(progress.lastSeenAt)) / MS_PER_DAY;
  return elapsedDays / interval;
}

/** Küçük kutu = yeni öğrenilen = daha sık. */
function boxWeight(progress: QuestionProgress): number {
  return 2 ** (MAX_BOX - progress.box);
}

/**
 * Zamanı gelmiş ve yeni soruların çekilişteki ağırlığı. Büyük sayı = daha
 * sık gelir. Zamanı gelmemiş sorular yalnızca yedek katmanda ve
 * notDueWeightOf ile tartılır.
 *
 * Gecikme oranı 1'in altına inmez: tekrar günü takvimle sayıldığı için
 * dün akşam görülen kutu 1 sorusu bugün öğleden sonra, 24 saati dolmadan
 * gelmiş olur; tam kutu ağırlığı alır.
 *
 * `question` şu an hesaba girmiyor; imzada duruyor ki zorluk ya da kategori
 * ağırlığı eklendiğinde çağıran tarafların değişmesi gerekmesin.
 */
export function weightOf(
  _question: Question,
  progress: QuestionProgress | undefined,
  now: Date,
): number {
  if (!progress) return NEW_QUESTION_WEIGHT;

  // Bozuk tarih bütün seçimi NaN'a çevirmesin diye clamp tabana düşürür.
  const overdue = clamp(elapsedRatio(progress, now), MIN_OVERDUE, MAX_OVERDUE);

  // Gecikme kutu ağırlığını 3 katına kadar açar.
  return boxWeight(progress) * overdue;
}

/**
 * Yedek katmanın ağırlığı: havuzdaki her sorunun zamanı gelmemiş ve yeni
 * soru da yok. Zamanına en yakın olan ağır basar: kutu ağırlığı ×
 * (geçen/aralık)². Az önce görülmüş soru neredeyse hiç gelmez; oran
 * FALLBACK_MIN_RATIO'nun altına inmediği için yine de sıfır olmaz.
 */
export function notDueWeightOf(
  _question: Question,
  progress: QuestionProgress,
  now: Date,
): number {
  const ratio = clamp(elapsedRatio(progress, now), FALLBACK_MIN_RATIO, 1);
  return boxWeight(progress) * ratio ** 2;
}

export type DrawInput = {
  questions: readonly Question[];
  /** questionId -> ilerleme. Eksik anahtar "hiç sorulmadı" demektir. */
  progress: Readonly<Record<string, QuestionProgress>>;
  /**
   * Yalnızca buradaki kategorilerden soru çekilir.
   * Boş dizi "hiçbiri" demektir ve çekiliş null döner — arayüz bu durumda
   * "en az bir kategori seç" diyebilsin. `string` değil `Category`:
   * yanlış yazılmış bir kategori adı havuzu sessizce boşaltmasın.
   */
  activeCategories: readonly Category[];
  /** Eskiden yeniye sıralı geçmiş; yalnızca sondaki COOLDOWN_SIZE tanesi elenir. */
  recentIds: readonly string[];
  now: Date;
  /** [0,1) aralığında sayı döndürür. Math.random çağıranda kalır, burada değil. */
  rng: () => number;
};

/**
 * Aktif kategorilerden, son sorulanları atlayarak ve zamanı gelenleri öne
 * alarak ağırlıklı bir soru seçer. Havuz hiçbir şekilde doldurulamıyorsa
 * null döner.
 */
export function drawQuestion({
  questions,
  progress,
  activeCategories,
  recentIds,
  now,
  rng,
}: DrawInput): Question | null {
  const byCategory = questions.filter((q) =>
    activeCategories.includes(q.category),
  );

  const cooling = new Set(recentIds.slice(-COOLDOWN_SIZE));
  const fresh = byCategory.filter((q) => !cooling.has(q.id));

  // Soğutma havuzu tükettiyse tekrar göstermek hiç göstermemekten iyidir.
  const pool = fresh.length > 0 ? fresh : byCategory;
  if (pool.length === 0) return null;

  // Soğutmadan sonra öncelik: zamanı gelmiş > yeni > zamanı gelmemiş.
  const { questions: candidates, fallback } = candidatesOf(pool, progress, now);
  const weights = candidates.map((q) => {
    const entry = progress[q.id];
    return fallback && entry ? notDueWeightOf(q, entry, now) : weightOf(q, entry, now);
  });

  return pickWeighted(candidates, weights, rng);
}

/** Ağırlıklı seçim: rng'den gelen tek sayı kümülatif toplamda gezdirilir. */
function pickWeighted(
  candidates: readonly Question[],
  weights: readonly number[],
  rng: () => number,
): Question {
  const total = weights.reduce((sum, w) => sum + w, 0);

  // Ağırlıklar bir şekilde sıfırlandıysa bile çekiliş bir soru döndürmeli.
  if (total <= 0) return candidates[0];

  let cursor = clamp(rng(), 0, 1) * total;
  for (let i = 0; i < candidates.length; i++) {
    cursor -= weights[i];
    if (cursor < 0) return candidates[i];
  }

  // rng tam 1 döndürdüyse döngü imleci tüketmeden biter; son soru doğrusu.
  return candidates[candidates.length - 1];
}

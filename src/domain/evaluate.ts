import type { Evaluation, Question } from "./question";

/* ------------------------------------------------------------------ */
/* Değerlendirme — saf katman, model yok                               */
/*                                                                     */
/* Bu dosya hiçbir embedding/model çağrısı yapmaz. evaluateSemantic     */
/* skorları dışarıdan (tarayıcıdaki embedding katmanından) alır; kendi   */
/* içinde yalnızca eşikleme ve Evaluation biçimine dökme var. Böylece    */
/* Vitest'te model indirmeden test edilebiliyor.                        */
/* ------------------------------------------------------------------ */

/**
 * Kelime içindeki tire ve alt çizgi: yalnızca iki harf ya da rakam
 * arasındakiler. "health-check", "service_healthy" boşluklu yazımla aynı
 * olur; "-p", "sh -c", "copy --from", "__html" gibi baştaki işaretler
 * kalır. Hepsi boşluğa çevrilseydi "-?" yalnızca "?" olup her soru
 * işaretini, "-slim" "teslim"in içini tutardı.
 */
const WORD_JOINER = /(?<=[\p{L}\p{N}])[-_]+(?=[\p{L}\p{N}])/gu;

/**
 * Türkçe karakterleri sadeleştirir, küçük harfe çevirir, kelime içi tire
 * ve alt çizgiyi boşluğa çevirir, fazla boşluğu temizler. Küçük harfe
 * çevirme Türkçe yerel ayarıyla: "I" önce "ı" olur, sonra "i" — Türkçe
 * olmayan bir `toLowerCase` bunu "i̇" yapardı.
 *
 * Cevap da alias da buradan geçer; tireli bir alias boşluklu cevabı,
 * boşluklu bir alias tireli cevabı tutar. Bitişik yazım ("healthcheck")
 * ayrı kalır: gereken yerde iki yazım da alias olarak eklenir.
 */
export function normalizeTr(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(WORD_JOINER, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Yedek yol: alias eşleşmesi. Embedding hiç yüklenemediğinde ya da
 * kullanıcı çevrimdışıyken buraya düşülür.
 */
export function evaluateLexical(question: Question, answer: string): Evaluation {
  const haystack = normalizeTr(answer);
  const hits: string[] = [];
  const missing: string[] = [];

  for (const concept of question.keyConcepts) {
    const found = concept.aliases.some((alias) => haystack.includes(normalizeTr(alias)));
    if (found) hits.push(concept.id);
    else missing.push(concept.id);
  }

  return { source: "lexical", hits, missing };
}

/* ------------------------------------------------------------------ */
/* KULLANILMIYOR — v1'de semantik (embedding) değerlendirme çıkarıldı.  */
/*                                                                      */
/* e5-small ile ölçüldü: alakasız çapalar 0.88, doğru kavramlar         */
/* 0.88-0.91 skor alıyordu — Türkçede aradaki fark eşik koyacak kadar    */
/* ayrışmıyor. Aşağıdaki fonksiyonlar silinmedi: semantik eşleştirme    */
/* yeniden denenirse ölçüm ve eşikleme buradan devralınır. Uygulama içi */
/* yapay zekâ değerlendirmesi de denenip kaldırıldı (bkz. CLAUDE.md).   */
/* Hiçbir çağıran yok, testleri bilerek kalıyor.                        */
/* ------------------------------------------------------------------ */

/**
 * Kavram skoru bu değerin üstünde olmadan hiçbir zaman yakalanmış sayılmaz
 * — yem havuzu boş olsa bile son çizgi budur. Kalibrasyon seti ile
 * ayarlanacak, şu an yer tutucu.
 */
export const ABSOLUTE_FLOOR = 0.8;

/**
 * Karşılaştırmalı pay: kavram skoru, yem havuzuna (aynı kategorideki diğer
 * soruların çapaları) olan en yüksek benzerlikten (baseline) bu kadar
 * yüksek olmalı. Model bazı cevaplara genel olarak yüksek skor veriyorsa
 * (ör. çok kısa, genel bir cümle) bu pay onu eler — mutlak eşik tek başına
 * ayırt edemiyordu.
 */
export const MARGIN = 0.02;

/**
 * Bir sorunun yem havuzu: aynı kategorideki diğer soruların çapa cümleleri.
 * Kendi sorusu hariç tutulur. En fazla `limit` cümle döner — embedding
 * turu sınırsız büyümesin. Sıra, `allQuestions` sırasına bağlıdır; bu
 * içerik dosyası sırasıdır ve soru başına sabittir.
 */
const MAX_DECOY_ANCHORS = 20;

export function collectDecoyAnchors(
  question: Question,
  allQuestions: readonly Question[],
  limit = MAX_DECOY_ANCHORS,
): string[] {
  const decoys: string[] = [];

  for (const other of allQuestions) {
    if (other.id === question.id || other.category !== question.category) continue;

    for (const concept of other.keyConcepts) {
      for (const anchor of concept.anchors) {
        if (decoys.length >= limit) return decoys;
        decoys.push(anchor);
      }
    }
  }

  return decoys;
}

/**
 * Asıl yol: tarayıcıda embedding ile hesaplanmış kosinüs benzerlikleri.
 * `scores` her keyConcept.id için [0,1] aralığında bir sayı taşır —
 * o kavramın çapa cümleleriyle cevap arasındaki en yüksek benzerlik.
 * Eksik anahtar 0 sayılır: embedding hiç hesaplanmamış bir kavram
 * yakalanmamış demektir.
 *
 * `baseline`, cevabın yem havuzuna olan en yüksek benzerliğidir (B).
 * Yem havuzu boşsa (aynı kategoride başka soru yok) `null` gelir ve
 * eşikleme mutlak eşiğe düşer — karşılaştırma yapacak bir şey yoktur.
 * Bir kavram, hem mutlak eşiği hem de baseline + pay'ı aşarsa yakalanır.
 */
export function evaluateSemantic(
  question: Question,
  answer: string,
  scores: Record<string, number>,
  baseline: number | null,
): Evaluation {
  const hits: string[] = [];
  const missing: string[] = [];
  const hitScores: number[] = [];
  const conceptScores: Record<string, number> = {};

  // Boş cevaba karşılık gelen skorlar güvenilir değil (çağıran taraf yine de
  // bir şeyler göndermiş olabilir); kestirmeden hepsi kaçırılmış sayılır.
  const isEmpty = answer.trim().length === 0;

  for (const concept of question.keyConcepts) {
    const score = isEmpty ? 0 : (scores[concept.id] ?? 0);
    conceptScores[concept.id] = score;

    const passesFloor = score > ABSOLUTE_FLOOR;
    const passesMargin = baseline === null || score > baseline + MARGIN;

    if (passesFloor && passesMargin) {
      hits.push(concept.id);
      hitScores.push(score);
    } else {
      missing.push(concept.id);
    }
  }

  return {
    source: "semantic",
    hits,
    missing,
    // En düşük yakalanan skor: en zayıf eşleşme ne kadar zorlanmış gösterir.
    // Hiç yakalanan yoksa bir güven değeri de yok.
    confidence: hitScores.length > 0 ? Math.min(...hitScores) : undefined,
    scores: conceptScores,
    baseline: baseline ?? undefined,
  };
}

/**
 * KULLANILMIYOR (bkz. yukarıdaki not) — cevabı cümlelere böler; her cümle
 * embedding'e ayrı ayrı verilecekti. Kısaltmalardan ("örn.", "v.b.")
 * kaynaklanan yanlış bölünmeler burada ele alınmıyor — embedding kalitesi
 * bundan gerçekten etkilenirse kısaltma listesiyle geri dönülür.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

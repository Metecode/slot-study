import type { Category, Question } from "./question";

/* ------------------------------------------------------------------ */
/* Tambur düzeni — iki tamburun hangi yüzleri göstereceği               */
/*                                                                     */
/* Kazanan çekilişte belirlenir (draw.ts); burası yalnızca o kazananın  */
/* etrafına yüz dizer. İki tamburun her şeyi tek bir çiftten ve tek bir */
/* havuzdan türetilir: donmuş tamburun etiketi de dönen tamburun        */
/* şeridi de aynı düzenden gelir. Önceden donmuş etiket canlı filtreden, */
/* şerit son dönüşten okunuyordu; filtre değişince ödeme çizgisinde     */
/* "Siber Güvenlik · props.children" gibi var olmayan çiftler çıkıyordu.*/
/* ------------------------------------------------------------------ */

/** Bir tamburdaki yüz sayısı; bir tur bu kadar satır. */
export const FACES = 16;

/** Duruşta ödeme çizgisine oturan yüzün indeksi. */
export const WINNING_FACE = 6;

/** Ödeme çizgisinde duran kategori–konu çifti. */
export type ReelPair = { category: Category; topic: string };

/**
 * Tek tamburun durumu. Havuzda tek değer varsa tambur dönmez (frozen);
 * havuz tamamen boşsa değer null olur ve arayüz yer tutucu gösterir.
 */
export type ReelColumn<T> =
  | { kind: "spin"; faces: T[] }
  | { kind: "frozen"; value: T | null };

export type ReelLayout = {
  pair: ReelPair | null;
  category: ReelColumn<Category>;
  topic: ReelColumn<string>;
};

export function pairOf(question: Question): ReelPair {
  return { category: question.category, topic: question.topic };
}

/** Konu adları kategoriler arasında tekrar edebilir ("Temeller"); eşleşme ikisine birden bakar. */
function hasPair(pool: readonly Question[], pair: ReelPair): boolean {
  return pool.some((q) => q.category === pair.category && q.topic === pair.topic);
}

/**
 * Soru yokken (tur kapandı ya da hiç çevrilmedi) tamburda duracak çift.
 * Ekrandaki çift havuzda hâlâ varsa o kalır, tambur boşuna değişmesin;
 * filtre onu dışarıda bıraktıysa havuzun ilk sorusuna geçilir.
 * Çift geçerliyse aynı nesne döner; çağıran kimlikten "değişti mi"yi okur.
 */
export function restingPair(
  pool: readonly Question[],
  previous: ReelPair | null,
): ReelPair | null {
  if (previous && hasPair(pool, previous)) return previous;
  return pool.length > 0 ? pairOf(pool[0]) : null;
}

function distinct<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

/**
 * Havuzdan rastgele bir değer seçer. Önce tam yasak listesi denenir;
 * havuz buna yetmiyorsa yalnızca bitişik komşular korunur, o da
 * yetmiyorsa ne varsa alınır. Kural üç kademede gevşediği için küçük
 * havuzlarda bile tek geçişte biter, sonsuz döngü olmaz.
 */
function pickFace<T>(
  pool: readonly T[],
  banned: ReadonlySet<T>,
  adjacent: ReadonlySet<T>,
  rng: () => number,
): T {
  const strict = pool.filter((value) => !banned.has(value));
  const loose = strict.length > 0 ? strict : pool.filter((value) => !adjacent.has(value));
  const source = loose.length > 0 ? loose : pool;
  return source[Math.floor(rng() * source.length)];
}

/**
 * FACES uzunluğunda yüz dizisi üretir. Kazanan WINNING_FACE'te sabittir;
 * diğer yüzler havuzdan, art arda tekrarı ve kazanan komşuluğunu
 * engelleyerek doldurulur.
 *
 * `preferred` kazananın hemen üstü ve altı için öncelikli havuz: konu
 * tamburunda kazananın kategorisinin diğer konuları. Yasaklara takılmayan
 * bir değer yoksa o iki yüz de genel havuzdan gelir.
 */
export function buildFaces<T>(
  pool: readonly T[],
  winner: T,
  rng: () => number,
  preferred: readonly T[] = [],
): T[] {
  const effectivePool = pool.length > 0 ? pool : [winner];
  const faces = new Array<T>(FACES);
  faces[WINNING_FACE] = winner;

  // Kazananın iki komşusu önce doldurulur: pencerede onunla birlikte
  // görünen satırlar onlar, öncelikli havuzdan ilk onlar seçebilmeli.
  // Sonra halka kazananın ardından dolanır.
  const before = (WINNING_FACE - 1 + FACES) % FACES;
  const after = (WINNING_FACE + 1) % FACES;
  const order = [after, before];
  for (let step = 2; step < FACES - 1; step++) order.push((WINNING_FACE + step) % FACES);

  for (const idx of order) {
    // İki komşuluk mesafesindeki dolu yüzlerin hiçbiri seçilemez: pencerede
    // aynı anda üç satır göründüğü için tekrar ancak böyle engellenir.
    // Halka sarıldığından iki yöne de bakılır.
    // Kazanan da bu komşulardan biri olduğu için hemen öncesi ve sonrası
    // kendiliğinden ondan farklı kalır.
    const banned = new Set<T>();
    const adjacent = new Set<T>();
    for (const offset of [-2, -1, 1, 2]) {
      const neighbor = faces[(idx + offset + FACES) % FACES];
      if (neighbor === undefined) continue;
      banned.add(neighbor);
      // Yan yana iki aynı etiket en göze batanı; havuz daralırsa en son bu verilir.
      if (offset === -1 || offset === 1) adjacent.add(neighbor);
    }

    const besideWinner = idx === before || idx === after;
    const own = besideWinner ? preferred.filter((value) => !banned.has(value)) : [];
    faces[idx] =
      own.length > 0
        ? own[Math.floor(rng() * own.length)]
        : pickFace(effectivePool, banned, adjacent, rng);
  }

  return faces;
}

function column<T>(
  pool: readonly T[],
  winner: T,
  rng: () => number,
  preferred: readonly T[] = [],
): ReelColumn<T> {
  // Tek değerli havuzda dönüş, hepsi aynı yazan üç satırın kayması olurdu.
  if (pool.length <= 1) return { kind: "frozen", value: winner };
  return { kind: "spin", faces: buildFaces(pool, winner, rng, preferred) };
}

/**
 * İki tamburun düzeni.
 *
 * `pool` filtreden geçmiş sorular. `pair` havuzda olmayabilir: cevap
 * ekranındayken filtre değişirse ekrandaki soru yine gösterilir. Bu
 * yüzden çiftin kendisi her iki havuza da eklenir.
 *
 * Konu tamburu kazananın kategorisinin konularından kurulur; kategoride
 * pencereyi tekrarsız dolduracak kadar (en az üç) konu yoksa diğer
 * kategorilerin konuları da karışır, ama kazananın komşuları yine önce
 * kendi kategorisinden seçilir. Dönme/donma kararı tüm havuza bakar:
 * kategorisi tek konulu bir soru geldiğinde konu tamburu sol durmadan
 * yazısını göstermesin.
 */
export function buildReelLayout(
  pool: readonly Question[],
  pair: ReelPair | null,
  rng: () => number,
): ReelLayout {
  if (!pair) {
    return {
      pair: null,
      category: { kind: "frozen", value: null },
      topic: { kind: "frozen", value: null },
    };
  }

  const categories = distinct([pair.category, ...pool.map((q) => q.category)]);
  const allTopics = distinct([pair.topic, ...pool.map((q) => q.topic)]);
  const ownTopics = distinct([
    pair.topic,
    ...pool.filter((q) => q.category === pair.category).map((q) => q.topic),
  ]);

  const topicPool = ownTopics.length >= 3 ? ownTopics : allTopics;
  const topic =
    allTopics.length <= 1
      ? ({ kind: "frozen", value: pair.topic } as const)
      : ({ kind: "spin", faces: buildFaces(topicPool, pair.topic, rng, ownTopics) } as const);

  return {
    pair,
    category: column(categories, pair.category, rng),
    topic,
  };
}

import type { Store } from "./progress";
import { CATEGORIES } from "./question";
import type { Category } from "./question";

/* ------------------------------------------------------------------ */
/* Açılışta kategori seçimi — sonradan gelen kategori açık başlar      */
/* ------------------------------------------------------------------ */

/*
  Seçim diskte olduğu gibi duruyor; içeriğe sonradan eklenen bir kategori
  mevcut kullanıcının listesinde olmadığı için kapalı geliyordu. Çip
  görünüyor ama seçili değildi, yeni sorular havuza hiç girmiyordu.
  knownCategories kullanıcının daha önce gördüğü kategorileri tutar:
  orada olmayan bir kategoriyi kullanıcı kapatmış olamaz, açık gelir.
  Orada olup seçimde olmayan ise bilinçli olarak kapatılmıştır, kapalı kalır.
*/

/**
 * knownCategories alanı gelmeden önceki son sürümde (1.0.1) içeriği olan
 * kategoriler. Alanı olmayan eski kayıt bunları görmüş sayılır.
 *
 * Tarihsel bir kayıt: yeni kategori eklenince DEĞİŞMEZ. "İçerikteki
 * kategoriler eksi bu sürümde eklenenler" diye hesaplansaydı her sürümde
 * güncellenmesi gerekirdi; unutulduğunda 1.0.1'den birkaç sürüm atlayan
 * kullanıcıda aradaki kategoriler kapalı gelirdi. Category değil string:
 * ileride bir kategori kaldırılsa da bu liste geçmişi anlatmaya devam eder.
 */
export const LEGACY_KNOWN_CATEGORIES: readonly string[] = [
  "javascript",
  "sql",
  "react",
  "docker",
  "dotnet",
  "cybersecurity",
];

export type HydratedCategories = {
  activeCategories: Category[];
  knownCategories: Category[];
};

/**
 * @param contentCategories İçinde en az bir soru olan kategoriler
 *   (AVAILABLE_CATEGORIES): kullanıcının seçicide göreceği liste.
 */
export function hydrateCategories(
  settings: Pick<Store["settings"], "activeCategories" | "knownCategories" | "initialized">,
  contentCategories: readonly Category[],
): HydratedCategories {
  // İlk açılışta (initialized false) kullanıcı henüz hiçbir seçim
  // yapmadı — hepsi açık gelsin. Sonraki açılışlarda dizi ne ise o
  // kalır: kullanıcı hepsini kapatmışsa bu bilinçli bir seçim,
  // boş diye tekrar hepsini açmak o seçimi geri alır.
  if (!settings.initialized) {
    return {
      activeCategories: [...CATEGORIES],
      knownCategories: nextKnown(settings.knownCategories ?? [], contentCategories),
    };
  }

  // Alan yoksa kayıt knownCategories'ten önceki bir sürümden geliyor.
  // Seçime dokunulmaz; yalnızca o sürümden sonra gelen kategoriler açılır.
  // Boş dizi sayılsaydı kullanıcının kapattığı her kategori bir kez açılırdı.
  const known = settings.knownCategories ?? LEGACY_KNOWN_CATEGORIES;

  // Diskteki kategori adı içerikten kalkmış ya da yeniden adlandırılmış
  // olabilir; tanınmayan ad çekiliş havuzunu sessizce boşaltmasın.
  const active = settings.activeCategories.filter(isCategory);
  const unseen = contentCategories.filter(
    (category) => !known.includes(category) && !active.includes(category),
  );

  return {
    activeCategories: [...active, ...unseen],
    knownCategories: nextKnown(known, contentCategories),
  };
}

/**
 * İçerikten kalkan kategori bilinenlerden DÜŞMEZ: kullanıcının kapattığı
 * bir kategori bir süre içerikte olmadı diye (geri çekilen içerik, ileride
 * daha az kategorili bir dil) geri döndüğünde yeni sayılıp açılmasın.
 *
 * CATEGORIES'ten kalkan ise düşer, activeCategories'ten düştüğü gibi.
 * Kalsaydı geri döndüğünde "bilinen" sayılır ve kapalı gelirdi — tam da
 * bu modülün önlediği durum.
 *
 * Sıra CATEGORIES'ten: kayıt her açılışta aynı çıksın.
 */
function nextKnown(previous: readonly string[], contentCategories: readonly Category[]): Category[] {
  return CATEGORIES.filter(
    (category) => previous.includes(category) || contentCategories.includes(category),
  );
}

function isCategory(name: string): name is Category {
  return (CATEGORIES as readonly string[]).includes(name);
}

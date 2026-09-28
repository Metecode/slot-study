/* ------------------------------------------------------------------ */
/* Depolama arayüzü — platformdan bağımsız, namespace'li key-value     */
/* ------------------------------------------------------------------ */

/*
  Web'de IndexedDB, native'de namespace başına tek JSON dosyası
  (filesystemAdapter.ts). Uygulama yalnızca bu arayüzü görür; hangi
  gerçeklemenin kullanılacağına platform/index.ts karar verir.

  Model bilerek düz: (ns, key) → değer. Index'e dayalı sorgu yok, bu
  yüzden IndexedDB'de tek object store'a, native'de ns başına bir
  { key: value } haritasına doğrudan eşleniyor.

  Adapter hata yutmaz. "Depo çalışmıyorsa uygulama yine açılsın" kararı
  çağıranın işi (bkz. storage/db.ts); adapter yalnızca iletir.
*/

export interface StorageAdapter {
  get<T>(ns: string, key: string): Promise<T | undefined>;
  getAll<T>(ns: string): Promise<Array<{ key: string; value: T }>>;
  set<T>(ns: string, key: string, value: T): Promise<void>;
  /**
   * Hepsi yazılır ya da hiçbiri: tek transaction. Native gerçekleme bunu
   * yalnızca tek namespace içinde sağlayabiliyor (tek dosya); birden çok
   * namespace verilirse hiçbir şey yazmadan reddeder.
   */
  setMany(entries: Array<{ ns: string; key: string; value: unknown }>): Promise<void>;
  delete(ns: string, key: string): Promise<void>;
  /** ns verilmezse tüm depo silinir. */
  clear(ns?: string): Promise<void>;
}

/*
  (ns, key) çifti tek bir düz anahtara "ns/key" olarak eşlenir. Bu biçim
  keyfi değil: mevcut kullanıcıların verisi IndexedDB'de tam olarak
  "mulakat-slot/store" anahtarında duruyor, yani ns "mulakat-slot", key
  "store". Biçimi değiştirmek o veriyi okunamaz yapar.
*/
export const NS_SEPARATOR = "/";

/**
 * ns ayırıcı içeremez; içerseydi "a/b" + "c" ile "a" + "b/c" aynı anahtara
 * düşerdi. key içinde ayırıcı serbest: önek ns'ten sonra ilk ayırıcıda biter.
 */
export function toFlatKey(ns: string, key: string): string {
  assertValidNamespace(ns);
  return `${ns}${NS_SEPARATOR}${key}`;
}

/** ns'e ait düz anahtarların ortak öneki: getAll ve clear(ns) bununla süzer. */
export function namespacePrefix(ns: string): string {
  assertValidNamespace(ns);
  return `${ns}${NS_SEPARATOR}`;
}

function assertValidNamespace(ns: string): void {
  if (ns.length === 0 || ns.includes(NS_SEPARATOR)) {
    throw new Error(`Geçersiz depo namespace'i: "${ns}"`);
  }
}

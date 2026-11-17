/* ------------------------------------------------------------------ */
/* Depo anahtarları                                                    */
/* ------------------------------------------------------------------ */

/*
  Tüm store tek kayıt. Web'de bu çift IndexedDB'de "mulakat-slot/store"
  anahtarına düşüyor — mevcut kullanıcıların verisi orada, değiştirme.
*/
export const STORE_NS = "mulakat-slot";
export const STORE_KEY = "store";

/**
 * Bozuk kaydın yedekleri: "store.corrupt-<ISO zaman>". ISO biçimi sözlük
 * sırasında zaman sırası olduğu için en eskiyi bulmak düz sıralama.
 */
export const CORRUPT_BACKUP_PREFIX = `${STORE_KEY}.corrupt-`;

/*
  Kullanım ölçümü ayrı namespace'te: store bozulup kurtarma akışı ayarları
  varsayılana döndürdüğünde kullanıcının kapatma tercihi kaybolmasın.
  Hesap silmede "bu cihazdaki verileri de sil" yalnızca kimliği ve kuyruğu
  siler; tercih (consent) kalır.
*/
export const ANALYTICS_NS = "slot-analytics";
export const ANALYTICS_CONSENT_KEY = "consent";
export const ANALYTICS_INSTALL_KEY = "install";
export const ANALYTICS_QUEUE_KEY = "queue";

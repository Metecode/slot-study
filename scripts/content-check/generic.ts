import { normalizeTr } from "../../src/domain/evaluate.ts";
import type { Category } from "../../src/domain/question.ts";

/* ------------------------------------------------------------------ */
/* Genel kelimeler — tek başına alias olamayacak kelimeler              */
/*                                                                     */
/* Değerlendirme düz `includes` olduğu için "veri" gibi bir alias,       */
/* konuyu bilmeyen birine hemen her cevapta kavram kazandırır. Listede   */
/* olmak kelimeyi ifade içinde yasaklamaz: "tablo" alias olamaz,         */
/* "tabloyu kilitler" olabilir. Karşılaştırma normalizeTr'den sonra.     */
/* Bu dosya tek kaynak; README'deki liste buradan kopyadır.             */
/* ------------------------------------------------------------------ */

/** Her kategoride geçen, hiçbir kavramı ayırt etmeyen kelimeler. */
export const COMMON_WORDS: readonly string[] = [
  "veri", "data", "nesne", "obje", "metot", "metod", "method", "sınıf", "class", "hata", "error", "performans",
  "kod", "değer", "value", "işlem", "fonksiyon", "function", "referans", "dizi", "liste", "bellek", "memory", "ram",
  "hız", "hızlı", "kullanılır", "kullanıcı", "user", "uygulama", "application", "sistem", "kontrol", "otomatik",
  "güvenli", "güvenlik", "sunucu", "server", "istemci", "client", "istek", "request", "yanıt", "response",
  "tarayıcı", "browser", "http", "dosya", "file", "url", "varsayılan", "default", "açık", "kapalı", "önce", "sonra",
  "ekle", "sil", "kendi", "sıra", "bağla", "bekle", "tercih", "doğrudan", "örnek", "örneği", "durum", "sonuç",
  "girdi", "input", "çıktı", "output", "yetki", "parametre", "izin", "tek bir", "birden fazla", "değişti",
  "değişken", "sabit", "test", "id", "sorun",
];

/** HTTP konuşan her cevapta geçenler; web ve siber güvenlik ortak. */
const HTTP_WORDS: readonly string[] = [
  "başlık", "header", "bağlantı", "connection", "adres", "durum kodu", "status", "java",
];

/**
 * Kategorinin hemen her cevabında geçen terimler; yalnızca o kategorinin
 * sorularında yasak. web ve siber güvenlik listeleri o sorular yazılırken
 * kullanılan denetimden geldi. javascript'inki TypeScript soruları gelince
 * eklendi: dil adları ve "tip" hemen her cevapta geçiyor.
 */
export const CATEGORY_WORDS: Partial<Record<Category, readonly string[]>> = {
  javascript: [
    "javascript", "typescript", "tip", "tipi", "type", "tür", "türü", "motor", "engine", "node", "node.js",
  ],
  docker: ["docker", "container", "konteyner", "image", "imaj", "dockerfile", "katman", "layer", "host"],
  react: ["react", "component", "bileşen", "state", "props", "prop", "render", "jsx", "hook", "dom"],
  sql: [
    "sql", "tablo", "table", "sorgu", "query", "satır", "row", "kolon", "column", "veritabanı", "database",
    "select", "from", "where", "postgresql", "postgres",
  ],
  dotnet: [".net", "dotnet", "c#", "csharp", "sql"],
  java: ["java", "spring"],
  web: HTTP_WORDS,
  cybersecurity: [
    ...HTTP_WORDS,
    "security", "secure", "saldırı", "attack", "saldırgan", "attacker", "şifre", "parola", "password",
    "zafiyet", "vulnerability", "risk", "koruma", "korur", "önlem", "token", "cookie", "çerez", "erişim",
    "access", "kimlik", "anahtar", "key", "doğrulama", "validation", "sorgu", "query", "script",
    "javascript", "html", "tehlikeli", "zararlı", "kötü niyetli", "malicious",
  ],
};

/** Bir kategorinin sorularında tek başına alias olamayacak kelimeler, normalize edilmiş. */
export function genericWordsFor(category: Category): ReadonlySet<string> {
  return new Set([...COMMON_WORDS, ...(CATEGORY_WORDS[category] ?? [])].map(normalizeTr));
}

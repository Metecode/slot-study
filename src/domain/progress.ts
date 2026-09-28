import { z } from "zod";

/* ------------------------------------------------------------------ */
/* İlerleme — kullanıcınındır, içerik güncellense de kalır             */
/* ------------------------------------------------------------------ */

/** Kutuyu kullanıcının kendi değerlendirmesi belirler, makine değil. */
export const selfRatingSchema = z.union([
  z.literal(0), // bilmiyordum
  z.literal(1), // kısmen
  z.literal(2), // biliyordum
]);
export type SelfRating = z.infer<typeof selfRatingSchema>;

export const boxSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
]);
export type Box = z.infer<typeof boxSchema>;

export const attemptSchema = z.object({
  at: z.string().datetime(),
  /** Kullanıcının yazdığı cevap. Zamanla nasıl değiştiğini görmek değerli. */
  answer: z.string(),
  hitCount: z.number().int().min(0),
  totalConcepts: z.number().int().min(1),
  selfRating: selfRatingSchema,
  /** Pas geçildiyse cevap yok, kutu 1'e düşer. */
  passed: z.boolean().default(false),
});
export type Attempt = z.infer<typeof attemptSchema>;

/**
 * Cevabın sert sınırı: cevap alanının maxLength'i ve senkron payload'u
 * bununla kesilir. Backend'de de aynı (ProgressValidator.MAX_ANSWER_LENGTH).
 *
 * attemptSchema'ya BİLEREK konmadı: eski kayıtlarda daha uzun cevap olabilir,
 * şema sıkılaşsaydı o kayıtlar "bozuk" sayılır ve kurtarma akışı tetiklenirdi.
 * Sınır yalnızca girişte ve senkronda uygulanır.
 */
export const MAX_ANSWER_LENGTH = 5000;

export const questionProgressSchema = z.object({
  questionId: z.string(),
  box: boxSchema,
  lastSeenAt: z.string().datetime(),
  /** Son N deneme tutulur; tamamı değil, dosya şişmesin. */
  attempts: z.array(attemptSchema).max(10),
});
export type QuestionProgress = z.infer<typeof questionProgressSchema>;

/**
 * Depoya yazılan kök nesne.
 * schemaVersion olmadan ilk kırıcı değişiklikte kullanıcı verisi çöp olur;
 * okuma tarafında bu alan migration anahtarı.
 */
export const SCHEMA_VERSION = 1;

export const storeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  progress: z.record(z.string(), questionProgressSchema),
  settings: z.object({
    fastMode: z.boolean().default(false),
    /**
     * Makine sesi. Varsayılan açık: ses makinenin hissinin parçası, kapatmak
     * isteyen köşedeki düğmeyi görüyor. Tarayıcı zaten ilk kol çekişine
     * kadar ses açmıyor, sayfa kendiliğinden ses çıkarmaz. Eski kayıtta
     * alan yok, default doldurur — kırıcı değil, schemaVersion artmıyor.
     */
    soundEnabled: z.boolean().default(true),
    /**
     * iOS sessiz anahtar ipucu bir kez gösterildi mi? Eski kayıtta alan yok,
     * default false: ipucu bir kez daha çıkar, kırıcı değil.
     */
    soundHintShown: z.boolean().default(false),
    /**
     * Titreşim (yalnızca native'de anahtarı var). Sesten bağımsız. Varsayılan
     * açık; eski kayıtta alan yok, default doldurur — kırıcı değil,
     * schemaVersion artmıyor.
     */
    hapticsEnabled: z.boolean().default(true),
    /**
     * Tekrar hatırlatıcısı (yalnızca native'de anahtarı var). Varsayılan
     * kapalı: bildirim izni ancak kullanıcı açınca istenir. Eski kayıtta
     * alan yok, default doldurur — kırıcı değil, schemaVersion artmıyor.
     */
    reminderEnabled: z.boolean().default(false),
    /**
     * Hatırlatıcı öneri kartı bir kez gösterildi mi? Hangi düğmeyle
     * kapatılırsa kapatılsın bir daha çıkmaz. Eski kayıtta default false.
     */
    reminderOfferShown: z.boolean().default(false),
    lang: z.enum(["tr", "en"]).default("tr"),
    activeCategories: z.array(z.string()).default([]),
    /**
     * İlk açılışta kategori seçimi hiç yapılmamış mı? Eski kayıtlarda alan
     * yok, default false gelir — bu da "henüz seçim yapılmadı" ile aynı
     * anlama geliyor, tesadüf değil: schemaVersion artmadan geriye dönük
     * uyumlu kalması bunun üstüne kurulu.
     */
    initialized: z.boolean().default(false),
  }),
});
export type Store = z.infer<typeof storeSchema>;

export const emptyStore = (): Store => ({
  schemaVersion: SCHEMA_VERSION,
  progress: {},
  settings: {
    fastMode: false,
    soundEnabled: true,
    soundHintShown: false,
    hapticsEnabled: true,
    reminderEnabled: false,
    reminderOfferShown: false,
    lang: "tr",
    activeCategories: [],
    initialized: false,
  },
});

/**
 * Bozuk veriyle uygulamayı kilitlemek yerine boş başlamak doğru:
 * kullanıcı ilerlemesini kaybeder ama uygulamayı kaybetmez.
 * Kayıp sessiz olmasın diye çağıran taraf uyarı gösterebilsin.
 */
export function readStore(raw: unknown): { store: Store; recovered: boolean } {
  const r = storeSchema.safeParse(raw);
  if (r.success) return { store: r.data, recovered: false };
  return { store: emptyStore(), recovered: true };
}
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* İçerik — repo'dan gelir, kullanıcıya ait değildir                   */
/* ------------------------------------------------------------------ */

export const CATEGORIES = [
  "java",
  "javascript",
  "sql",
  "react",
  "koleksiyonlar",
  "algoritma",
  "tasarim-kaliplari",
  "kafka-redis",
  "docker",
  "dotnet",
  "cybersecurity",
] as const;

export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

/**
 * Bir cevapta aranan tek bir kavram.
 * - aliases: yerel kelime eşleştirmesi (yedek yol, çevrimdışı çalışır)
 * - anchors: embedding karşılaştırması için çapa cümleler (asıl yol)
 * İkisi de zorunlu: anchors olmadan semantik değerlendirme yapılamaz,
 * aliases olmadan model indirilemediğinde uygulama körelir.
 */
export const keyConceptSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
  anchors: z.array(z.string().min(10)).min(1).max(4),
});
export type KeyConcept = z.infer<typeof keyConceptSchema>;

export const questionSchema = z.object({
  /** Diller arasında sabit kalır — tr ve en aynı id'yi paylaşır. */
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case olmalı"),
  category: categorySchema,
  /**
   * "definition": kavramı tanımla/açıkla türü sorular.
   * "applied": bir senaryoyu çöz, kod yaz, karar gerekçelendir türü sorular.
   * Alan yoksa (eski içerik) "definition" varsayılır.
   */
  kind: z.enum(["definition", "applied"]).default("definition"),
  /** Makara dilimi. Kategoriden dar, sorudan geniş: "Transaction", "Index". */
  topic: z.string().min(2).max(24),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  prompt: z.string().min(10),
  /** Markdown. Kısa tutulur — kart içinde okunacak, makale değil. */
  modelAnswer: z.string().min(20),
  // 3'ten az kavramla değerlendirme anlamlı ayrışmıyor; ipucu hep aynı
  // birkaç kavrama düşüyor.
  keyConcepts: z.array(keyConceptSchema).min(3).max(6),
  /** Mülakatçının devam sorusu. AI turu bunları örnek olarak kullanır. */
  followUps: z.array(z.string().min(10)).max(3).optional(),
  /** Katkı rehberi gereği: soru nereden türetildi. */
  source: z.string().optional(),
});
export type Question = z.infer<typeof questionSchema>;

/** Bir kategori dosyasının tamamı. CI bu şemayla doğrular. */
export const questionFileSchema = z.object({
  lang: z.enum(["tr", "en"]),
  category: categorySchema,
  questions: z.array(questionSchema).min(1),
});
export type QuestionFile = z.infer<typeof questionFileSchema>;

/**
 * İçinde en az bir soru olan kategoriler, CATEGORIES sırasında.
 *
 * CATEGORIES ileride eklenecek konuları da sayıyor; içeriği henüz
 * yazılmamış bir kategori arayüzde seçilebilir duruyordu ama seçilince
 * havuza hiçbir soru katmıyordu — tıklanabilir ama işe yaramayan bir
 * çip. Liste bu yüzden sabitten değil, gerçek içerikten türetilir.
 */
export function availableCategories(questions: readonly Question[]): Category[] {
  const filled = new Set(questions.map((question) => question.category));
  return CATEGORIES.filter((category) => filled.has(category));
}

/* ------------------------------------------------------------------ */
/* Değerlendirme — türetilmiş, saklanmaz                               */
/* ------------------------------------------------------------------ */

export const evaluationSchema = z.object({
  /** Hangi yol üretti: yerel embedding, kelime eşleşmesi ya da AI. */
  source: z.enum(["semantic", "lexical", "ai"]),
  hits: z.array(z.string()),   // keyConcept.id
  missing: z.array(z.string()),
  /** 0-1. Kutu geçişine doğrudan etki etmez, sadece gösterilir. */
  confidence: z.number().min(0).max(1).optional(),
  /**
   * keyConcept.id -> ham kosinüs benzerliği [0,1]. Yalnızca semantic yolda
   * dolar; geliştirme aracı içindir, üretim arayüzünde gösterilmez.
   */
  scores: z.record(z.string(), z.number()).optional(),
  /**
   * Cevabın yem havuzuna (aynı kategorideki diğer soruların çapaları) olan
   * en yüksek benzerliği — karşılaştırmalı eşiğin B'si. Yem havuzu boşsa
   * yok. Yalnızca geliştirme aracı içindir.
   */
  baseline: z.number().min(0).max(1).optional(),
  feedback: z.string().optional(),
  followUp: z.string().optional(),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

/* ------------------------------------------------------------------ */
/* Yükleme                                                             */
/* ------------------------------------------------------------------ */

export class ContentError extends Error {
  // Parametre özellikleri `erasableSyntaxOnly` ile derlenmiyor; alanlar
  // açıkça bildirilip constructor içinde atanır.
  readonly path: string;
  readonly issues: z.ZodIssue[];

  constructor(path: string, issues: z.ZodIssue[]) {
    super(`${path}: ${issues.length} doğrulama hatası`);
    this.path = path;
    this.issues = issues;
  }
}

export function parseQuestionFile(path: string, raw: unknown): QuestionFile {
  const r = questionFileSchema.safeParse(raw);
  if (!r.success) throw new ContentError(path, r.error.issues);

  const ids = new Set<string>();
  for (const q of r.data.questions) {
    if (ids.has(q.id)) {
      throw new ContentError(path, [
        { code: "custom", path: ["questions", q.id], message: "tekrar eden id" },
      ] as z.ZodIssue[]);
    }
    ids.add(q.id);

    if (q.category !== r.data.category) {
      throw new ContentError(path, [
        {
          code: "custom",
          path: ["questions", q.id, "category"],
          message: `dosya ${r.data.category} ama soru ${q.category}`,
        },
      ] as z.ZodIssue[]);
    }
  }
  return r.data;
}
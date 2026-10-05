import type { z } from "zod";

import { emptyStore, questionProgressSchema, SCHEMA_VERSION, storeSchema } from "./progress";
import type { QuestionProgress, Store } from "./progress";

/* ------------------------------------------------------------------ */
/* Bozuk kayıttan kurtarma — geçerli olanı koru, gerisini varsayılanla */
/* ------------------------------------------------------------------ */

/*
  readStore bozuk kaydı bütünüyle atıyor; tek bir hatalı deneme yüzünden
  kullanıcının tüm ilerlemesi gidiyordu. Burada her ilerleme kaydı ve her
  ayar alanı ayrı ayrı doğrulanır. Saf: log basmaz, ne kaybolduğunu
  döndürür; loglamak ve kullanıcıya söylemek çağıranın işi.

  readStore yerinde kalıyor: içe aktarmada bozuk dosya kurtarılmaz,
  reddedilir.
*/

export type SalvageResult = {
  store: Store;
  keptProgress: number;
  droppedProgress: number;
  /** progress alanı hiç okunamadı (yok ya da nesne değil); kaç kayıt vardı bilinmiyor. */
  progressUnreadable: boolean;
  /** Varsayılana döndürülen ayar alanları. */
  resetSettings: string[];
};

export function salvageStore(raw: unknown): SalvageResult {
  const root = isRecord(raw) ? raw : {};
  const progress = salvageProgress(root.progress);
  const settings = salvageSettings(root.settings);

  return {
    // Sürüm alanı bozuk olsa da kurtarılan veri bugünkü şemaya göre doğrulandı.
    store: { schemaVersion: SCHEMA_VERSION, progress: progress.kept, settings: settings.value },
    keptProgress: Object.keys(progress.kept).length,
    droppedProgress: progress.dropped,
    progressUnreadable: progress.unreadable,
    resetSettings: settings.reset,
  };
}

/** Kullanıcıya ne söyleneceğini belirleyen kayıp türü. */
export type RecoveryLoss = "allProgress" | "someProgress" | "settingsOnly";

export function recoveryLoss(result: SalvageResult): RecoveryLoss {
  const progressLost = result.progressUnreadable || result.droppedProgress > 0;
  if (progressLost && result.keptProgress === 0) return "allProgress";
  if (progressLost) return "someProgress";
  // İlerleme tam geldi; bozukluk ayarlarda (ya da yalnızca sürüm alanında,
  // o durumda da kullanıcının göreceği tek fark varsayılan ayarlar olabilir).
  return "settingsOnly";
}

/* ------------------------------------------------------------------ */
/* İç yardımcılar                                                      */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function salvageProgress(value: unknown): {
  kept: Record<string, QuestionProgress>;
  dropped: number;
  unreadable: boolean;
} {
  if (!isRecord(value)) return { kept: {}, dropped: 0, unreadable: true };

  const kept: Record<string, QuestionProgress> = {};
  let dropped = 0;
  for (const [questionId, record] of Object.entries(value)) {
    const parsed = questionProgressSchema.safeParse(record);
    if (parsed.success) kept[questionId] = parsed.data;
    else dropped += 1;
  }
  return { kept, dropped, unreadable: false };
}

function salvageSettings(value: unknown): { value: Store["settings"]; reset: string[] } {
  const defaults = emptyStore().settings;
  if (!isRecord(value)) return { value: defaults, reset: Object.keys(defaults) };

  // Daraltma iç fonksiyona taşınmıyor; tipi açıkça sabitlenmiş bir kopya.
  const source: Record<string, unknown> = value;
  const shape = storeSchema.shape.settings.shape;
  const reset: string[] = [];

  // Eksik alan hata değil: şemadaki default doldurur, eski kayıtlar böyle.
  // Yalnızca var olup geçersiz olan alan varsayılana döner ve sayılır.
  function pick<T>(name: keyof Store["settings"], schema: z.ZodType<T>, fallback: T): T {
    const parsed = schema.safeParse(source[name]);
    if (parsed.success) return parsed.data;
    reset.push(name);
    return fallback;
  }

  return {
    value: {
      fastMode: pick("fastMode", shape.fastMode, defaults.fastMode),
      soundEnabled: pick("soundEnabled", shape.soundEnabled, defaults.soundEnabled),
      soundHintShown: pick("soundHintShown", shape.soundHintShown, defaults.soundHintShown),
      hapticsEnabled: pick("hapticsEnabled", shape.hapticsEnabled, defaults.hapticsEnabled),
      reminderEnabled: pick("reminderEnabled", shape.reminderEnabled, defaults.reminderEnabled),
      reminderOfferShown: pick("reminderOfferShown", shape.reminderOfferShown, defaults.reminderOfferShown),
      lang: pick("lang", shape.lang, defaults.lang),
      activeCategories: pick("activeCategories", shape.activeCategories, defaults.activeCategories),
      // Geçersizse yok sayılır: eski kayıt gibi geçişten geçer.
      knownCategories: pick("knownCategories", shape.knownCategories, undefined),
      initialized: pick("initialized", shape.initialized, defaults.initialized),
    },
    reset,
  };
}

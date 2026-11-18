import { describe, expect, it } from "vitest";

import { AVAILABLE_CATEGORIES, HIDDEN_CATEGORIES, LOADED_QUESTIONS, QUESTIONS } from "./index";

/* ------------------------------------------------------------------ */
/* İçerik kaydı                                                        */
/*                                                                     */
/* Yeni bir tr/*.json dosyası index.ts'e import edilmeyi unutursa       */
/* sorular arayüze girmez ama seeder hepsini okuduğu için sunucuya      */
/* girer; hiçbir test kırılmaz. content-java.json bu yüzden bir süre     */
/* yalnızca sunucuda kaldı. Dosyalar burada dizinden okunur ve          */
/* yüklenen içerikle karşılaştırılır.                                   */
/* ------------------------------------------------------------------ */

type RawFile = { questions: Array<{ id: string }> };

const FILES_ON_DISK = import.meta.glob<RawFile>("./tr/*.json", { eager: true, import: "default" });

describe("içerik kaydı", () => {
  it("dizinde en az bir içerik dosyası bulunuyor", () => {
    expect(Object.keys(FILES_ON_DISK).length).toBeGreaterThan(0);
  });

  it("her tr/*.json dosyası index.ts'te kayıtlı", () => {
    const loadedIds = new Set(LOADED_QUESTIONS.map((question) => question.id));
    const unregistered = Object.entries(FILES_ON_DISK)
      .filter(([, file]) => file.questions.some((question) => !loadedIds.has(question.id)))
      .map(([path]) => path);

    expect(unregistered).toEqual([]);
  });
});

describe("gizli kategoriler", () => {
  it("gizli kategorinin soruları yüklenir ama yayında görünmez", () => {
    for (const category of HIDDEN_CATEGORIES) {
      expect(LOADED_QUESTIONS.some((question) => question.category === category)).toBe(true);
      expect(QUESTIONS.some((question) => question.category === category)).toBe(false);
      expect(AVAILABLE_CATEGORIES).not.toContain(category);
    }
  });

  it("dotnet gizli", () => {
    expect(HIDDEN_CATEGORIES.has("dotnet")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { hydrateCategories, LEGACY_KNOWN_CATEGORIES } from "./categoryHydration";
import type { Store } from "./progress";
import { CATEGORIES } from "./question";
import type { Category } from "./question";

type CategorySettings = Pick<Store["settings"], "activeCategories" | "knownCategories" | "initialized">;

// initialized: true varsayılanı: kullanıcı daha önce seçim yaptı.
function settings(over: Partial<CategorySettings> = {}): CategorySettings {
  return { activeCategories: [], initialized: true, ...over };
}

/** 1.0.1'in içeriği ve Java. Sıra AVAILABLE_CATEGORIES gibi CATEGORIES'ten. */
const WITH_JAVA: Category[] = ["java", "javascript", "sql", "react", "docker", "dotnet", "cybersecurity"];

describe("hydrateCategories", () => {
  it("içeriğe yeni gelen kategori açık gelir", () => {
    const result = hydrateCategories(
      settings({ activeCategories: ["sql"], knownCategories: ["javascript", "sql", "react"] }),
      ["java", "javascript", "sql", "react"],
    );

    expect(result.activeCategories).toEqual(["sql", "java"]);
    expect(result.knownCategories).toEqual(["java", "javascript", "sql", "react"]);
  });

  it("kullanıcının kapattığı bilinen kategori kapalı kalır", () => {
    const result = hydrateCategories(
      settings({ activeCategories: ["sql"], knownCategories: ["javascript", "sql", "react"] }),
      ["javascript", "sql", "react"],
    );

    expect(result.activeCategories).toEqual(["sql"]);
  });

  it("hepsini kapatan kullanıcıda bilinen kategoriler kapalı kalır", () => {
    const result = hydrateCategories(
      settings({ activeCategories: [], knownCategories: ["sql", "react"] }),
      ["sql", "react"],
    );

    expect(result.activeCategories).toEqual([]);
  });

  it("açık gelen yeni kategori kapatılınca sonraki açılışta kapalı kalır", () => {
    const content: Category[] = ["java", "sql"];
    const first = hydrateCategories(settings({ activeCategories: ["sql"], knownCategories: ["sql"] }), content);
    expect(first.activeCategories).toEqual(["sql", "java"]);

    // Kullanıcı Java'yı kapattı; kayıtta bilinenler ilk açılıştan geliyor.
    const second = hydrateCategories(
      settings({ activeCategories: ["sql"], knownCategories: first.knownCategories }),
      content,
    );

    expect(second.activeCategories).toEqual(["sql"]);
  });

  it("zaten açık olan yeni kategori iki kez eklenmez", () => {
    const result = hydrateCategories(
      settings({ activeCategories: ["sql", "java"], knownCategories: ["sql"] }),
      ["java", "sql"],
    );

    expect(result.activeCategories).toEqual(["sql", "java"]);
  });

  it("ilk açılışta (initialized false) tüm kategoriler seçili gelir", () => {
    const result = hydrateCategories(settings({ initialized: false }), ["sql", "react"]);

    expect(result.activeCategories).toEqual([...CATEGORIES]);
    expect(result.knownCategories).toEqual(["sql", "react"]);
  });

  describe("eski kayıt (knownCategories yok)", () => {
    it("seçime dokunmaz, yalnızca 1.0.1'den sonra gelen kategoriyi açar", () => {
      // Kullanıcı javascript, react, dotnet ve cybersecurity'yi kapatmıştı.
      const result = hydrateCategories(settings({ activeCategories: ["sql", "docker"] }), WITH_JAVA);

      expect(result.activeCategories).toEqual(["sql", "docker", "java"]);
      expect(result.knownCategories).toEqual(WITH_JAVA);
    });

    it("geçiş listesinde java yok", () => {
      expect(LEGACY_KNOWN_CATEGORIES).not.toContain("java");
    });

    it("birkaç sürüm atlayan kullanıcıda aradaki kategorilerin hepsi açılır", () => {
      const later: Category[] = [...WITH_JAVA, "kafka-redis"];

      const result = hydrateCategories(settings({ activeCategories: ["sql"] }), later);

      expect(result.activeCategories).toEqual(["sql", "java", "kafka-redis"]);
    });

    it("seçiciye hiç dokunmamış kullanıcıda kalkan ad düşer, yeni kategori eklenir", () => {
      // İlk açılışta yazılan liste: o günün CATEGORIES'i, java-spring dahil.
      const old = ["java-spring", "javascript", "sql", "react", "koleksiyonlar", "algoritma",
        "tasarim-kaliplari", "kafka-redis", "docker", "dotnet", "cybersecurity"];

      const result = hydrateCategories(settings({ activeCategories: old }), WITH_JAVA);

      expect(result.activeCategories).toEqual([...old.slice(1), "java"]);
    });
  });

  describe("içerikten kalkan kategori", () => {
    it("bilinenlerden düşmez; geri döndüğünde kullanıcının seçimi korunur", () => {
      // react kapalı; bir sürüm içerikten çekiliyor.
      const withdrawn = hydrateCategories(
        settings({ activeCategories: ["sql"], knownCategories: ["sql", "react"] }),
        ["sql"],
      );
      expect(withdrawn.knownCategories).toEqual(["sql", "react"]);

      const returned = hydrateCategories(
        settings({ activeCategories: withdrawn.activeCategories, knownCategories: withdrawn.knownCategories }),
        ["sql", "react"],
      );
      expect(returned.activeCategories).toEqual(["sql"]);
    });

    it("CATEGORIES'ten kalkan ad bilinenlerden de düşer", () => {
      const result = hydrateCategories(
        settings({ activeCategories: ["sql"], knownCategories: ["java-spring", "sql"] }),
        ["sql"],
      );

      expect(result.knownCategories).toEqual(["sql"]);
    });
  });
});

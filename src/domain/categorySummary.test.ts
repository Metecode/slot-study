import { describe, expect, it } from "vitest";

import { summarizeCategories } from "./categorySummary";
import type { Category } from "./question";

const CATEGORIES: Category[] = ["javascript", "sql", "react", "docker", "dotnet", "cybersecurity"];

describe("summarizeCategories", () => {
  it("hepsi seçiliyken kesir yazmaz", () => {
    expect(summarizeCategories(CATEGORIES, CATEGORIES, 13)).toBe("6 kategori · 13 soru");
  });

  it("kısmi seçimde seçili/toplam yazar", () => {
    const active: Category[] = ["javascript", "sql", "react", "docker", "dotnet"];
    expect(summarizeCategories(active, CATEGORIES, 11)).toBe("5/6 kategori · 11 soru");
  });

  it("tek seçimde de aynı kalıbı kullanır", () => {
    expect(summarizeCategories(["javascript"], CATEGORIES, 1)).toBe("1/6 kategori · 1 soru");
  });

  it("hiçbiri seçili değilken 0 yazar", () => {
    expect(summarizeCategories([], CATEGORIES, 0)).toBe("0/6 kategori · 0 soru");
  });

  it("gösterilmeyen bir kategori seçimde kalsa da sayılmaz", () => {
    // "sql" seçili ama bu içerik sürümünde gösterilmiyor.
    const shown: Category[] = ["javascript", "react"];
    expect(summarizeCategories(["javascript", "sql"], shown, 4)).toBe("1/2 kategori · 4 soru");
    expect(summarizeCategories(["javascript", "sql", "react"], shown, 7)).toBe("2 kategori · 7 soru");
  });
});

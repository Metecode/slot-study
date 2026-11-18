import { describe, expect, it } from "vitest";

import { CATEGORIES, availableCategories } from "./question";
import type { Question } from "./question";

/* ------------------------------------------------------------------ */
/* availableCategories — boş kategori arayüzde görünmemeli             */
/* ------------------------------------------------------------------ */

/** Testin ilgilendiği tek alan kategori; gerisi şemayı doyurmak için. */
function makeQuestion(category: Question["category"], id: string): Question {
  return {
    id,
    category,
    kind: "definition",
    topic: "Konu",
    difficulty: 1,
    origin: { kind: "own" },
    prompt: "Bu bir test sorusudur.",
    modelAnswer: "Bu, testin beklediği kadar uzun bir model cevaptır.",
    keyConcepts: [
      { id: "a", label: "A", aliases: ["a"], anchors: ["yeterince uzun çapa cümlesi"] },
      { id: "b", label: "B", aliases: ["b"], anchors: ["yeterince uzun çapa cümlesi"] },
      { id: "c", label: "C", aliases: ["c"], anchors: ["yeterince uzun çapa cümlesi"] },
    ],
  };
}

describe("availableCategories", () => {
  it("yalnızca içinde soru olan kategorileri döndürür", () => {
    const questions = [makeQuestion("sql", "s1"), makeQuestion("react", "r1")];
    expect(availableCategories(questions)).toEqual(["sql", "react"]);
  });

  it("aynı kategoriden birden fazla soru olsa da kategoriyi bir kez sayar", () => {
    const questions = [makeQuestion("sql", "s1"), makeQuestion("sql", "s2")];
    expect(availableCategories(questions)).toEqual(["sql"]);
  });

  it("sırayı CATEGORIES'ten alır, sorulardan değil", () => {
    const questions = [makeQuestion("react", "r1"), makeQuestion("javascript", "j1")];
    const result = availableCategories(questions);
    const expected = CATEGORIES.filter((c) => c === "javascript" || c === "react");
    expect(result).toEqual([...expected]);
  });

  it("içerik boşsa boş liste döner", () => {
    expect(availableCategories([])).toEqual([]);
  });
});

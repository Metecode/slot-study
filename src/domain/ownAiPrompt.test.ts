import { describe, expect, it } from "vitest";

import { buildOwnAiPrompt } from "./ownAiPrompt";
import type { Question } from "./question";

function makeQuestion(): Question {
  return {
    id: "sql-index",
    category: "sql",
    kind: "definition",
    topic: "Index",
    difficulty: 2,
    origin: { kind: "own" },
    prompt: "  Index nedir ve ne zaman zarar verir?  ",
    modelAnswer: "MODEL CEVAP: index okumayı hızlandırır, yazmayı yavaşlatır.",
    keyConcepts: [
      {
        id: "okuma",
        label: "Okuma hızı",
        aliases: ["okuma"],
        anchors: ["Index aramayı tam tarama yerine ağaç üzerinden yapar.", "İkinci çapa hiç görünmemeli."],
      },
      {
        id: "yazma",
        label: "Yazma maliyeti",
        aliases: ["yazma"],
        anchors: ["Her INSERT ve UPDATE index'i de güncellemek zorundadır."],
      },
    ],
  };
}

describe("buildOwnAiPrompt", () => {
  it("soruyu, cevabı ve kriterleri istenen yapıda yazar", () => {
    const prompt = buildOwnAiPrompt(makeQuestion(), "  Index aramayı hızlandırır.\n");

    expect(prompt).toBe(
      [
        "Teknik mülakat sorusu:",
        "Index nedir ve ne zaman zarar verir?",
        "",
        "Benim cevabım:",
        "Index aramayı hızlandırır.",
        "",
        "Değerlendirme kriterleri (iyi bir cevapta olması beklenenler):",
        "- Okuma hızı: Index aramayı tam tarama yerine ağaç üzerinden yapar.",
        "- Yazma maliyeti: Her INSERT ve UPDATE index'i de güncellemek zorundadır.",
        "",
        "Cevabımı bu kriterlere göre değerlendir: hangilerini karşıladım, hangilerini kaçırdım? " +
          "En önemli eksiğimi, mülakatta neden önemli olduğuyla birlikte açıkla. " +
          "Sonra bana bir devam sorusu sor.",
      ].join("\n"),
    );
  });

  it("yalnızca ilk çapayı kullanır", () => {
    expect(buildOwnAiPrompt(makeQuestion(), "cevap")).not.toContain("İkinci çapa");
  });

  it("model cevabı koymaz: prompt kısa kalsın", () => {
    expect(buildOwnAiPrompt(makeQuestion(), "cevap")).not.toContain("MODEL CEVAP");
  });

  it("çok satırlı cevabın iç satırlarını korur", () => {
    const prompt = buildOwnAiPrompt(makeQuestion(), "birinci satır\nikinci satır");

    expect(prompt).toContain("Benim cevabım:\nbirinci satır\nikinci satır\n");
  });

  it("çapası olmayan kavramda yalnızca adı yazar", () => {
    const question = makeQuestion();
    question.keyConcepts[1] = { ...question.keyConcepts[1], anchors: [] };

    expect(buildOwnAiPrompt(question, "cevap")).toContain("- Yazma maliyeti\n");
  });

  it("girdiyi değiştirmez", () => {
    const question = makeQuestion();
    const before = JSON.stringify(question);

    buildOwnAiPrompt(question, "cevap");

    expect(JSON.stringify(question)).toBe(before);
  });
});

import { describe, expect, it } from "vitest";

import type { KeyConcept, Question } from "../../src/domain/question.ts";

import { parseArgs } from "./cli.ts";
import { diffLines } from "./compare.ts";
import { formatIssues, sentenceCount } from "./format.ts";
import { findPairs } from "./pairs.ts";
import { overlay } from "./pool.ts";
import { conceptWarnings, indexAnswers } from "./rules.ts";
import { findSubstringTraps } from "./substrings.ts";

/* Kurallar küçük, elle kurulmuş sorularla; gerçek içeriğe bağlı değil. */

function concept(id: string, aliases: string[]): KeyConcept {
  return { id, label: id, aliases, anchors: [`${id} kavramının çapa cümlesi.`] };
}

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    category: "sql",
    kind: "definition",
    topic: "Index",
    difficulty: 1,
    prompt: `${id} nedir, açıkla?`,
    modelAnswer: "Alfa ile beta birlikte çalışır. Gama ise ayrı durur.",
    keyConcepts: [concept("a", ["alfa", "alpha"]), concept("b", ["beta", "bêta"]), concept("c", ["gama", "gamma"])],
    followUps: ["Bir devam sorusu burada?"],
    source: "Kendi derleme — PostgreSQL 18 Docs: Indexes",
    ...overrides,
  };
}

describe("sentenceCount", () => {
  it("satır içi kodu tek kelime sayar", () => {
    expect(sentenceCount("`a.b()` çağrılır. Sonra `x. y` gelir.")).toBe(2);
  });

  it("kod dışındaki kısaltma noktası cümle böler", () => {
    expect(sentenceCount("Sınır ör. 500 satırdır.")).toBe(2);
  });
});

describe("formatIssues", () => {
  it("yeni biçimdeki cevapta sorun yok", () => {
    expect(formatIssues(question("q"))).toEqual([]);
  });

  it("not kutusunu, kod bloğunu ve paragraf sayısını bildirir", () => {
    const modelAnswer = "Alfa beta ile çalışır. Gama ayrıdır.\n\nSık atlanan nokta: gama kilitlenir.\n\n```sql\nSELECT 1;\n```";
    expect(formatIssues(question("q", { modelAnswer }))).toEqual([
      'not kutusu: "Sık atlanan nokta"',
      "kod bloğu",
      "2 paragraf",
    ]);
  });

  it("madde listesini, eksik followUp'ı ve source biçimini bildirir", () => {
    const issues = formatIssues(question("q", {
      modelAnswer: "Üç adım var.\n- alfa çalışır\n- beta çalışır",
      followUps: undefined,
      source: "Vakıfbank teknik mülakatı",
    }));
    expect(issues).toEqual(["madde listesi", "followUp yok", "source biçimi"]);
  });
});

describe("conceptWarnings", () => {
  it("genel, kısa ve soruda geçen alias'ları bildirir", () => {
    const target = question("index-nedir", {
      keyConcepts: [concept("a", ["alfa", "tablo"]), concept("b", ["beta", "pk"]), concept("c", ["gama", "index"])],
    });
    expect(conceptWarnings(target, indexAnswers([target]))).toEqual([
      'a: genel alias "tablo"',
      'b: kısa alias "pk"',
      'c: alias soruda geçiyor "index"',
    ]);
  });

  it("model cevabın tutmadığı kavramı bildirir", () => {
    const target = question("q", { modelAnswer: "Alfa ile beta yeter. Başka bir şey yok." });
    expect(conceptWarnings(target, indexAnswers([target]))).toEqual(["model cevap tutmuyor: c"]);
  });

  it("beş başka cevapta geçen tek kelimeyi sık sayar", () => {
    const target = question("q", { keyConcepts: [concept("a", ["alfa", "kilit"]), concept("b", ["beta", "bêta"]), concept("c", ["gama", "gamma"])] });
    const others = [1, 2, 3, 4, 5].map((n) => question(`o${n}`, { modelAnswer: "Satıra kilit konur. Sonra bırakılır." }));
    expect(conceptWarnings(target, indexAnswers([target, ...others]))).toEqual(['a: sık tek kelime "kilit" (5 başka cevap)']);
    expect(conceptWarnings(target, indexAnswers([target, ...others.slice(1)]))).toEqual([]);
  });
});

describe("findPairs", () => {
  it("kavramların yarısını tutan cevabı çift sayar ve sınıflar", () => {
    const target = question("t");
    const sibling = question("s", { modelAnswer: "Alfa ve beta burada da geçer. Bitti." });
    const sameCategory = question("o", { topic: "Join", modelAnswer: "Alfa ve gama burada. Bitti." });
    const otherCategory = question("x", { category: "java", modelAnswer: "Beta ve gama orada. Bitti." });
    const onlyOne = question("y", { modelAnswer: "Yalnızca alfa var. Bitti." });

    const pairs = findPairs([target, sibling, sameCategory, otherCategory, onlyOne])
      .filter((pair) => pair.target.id === "t")
      .map((pair) => `${pair.other.id} ${pair.kind} ${pair.hits.join("+")}`);
    expect(pairs).toEqual(["s kardeş a+b", "o aynı-kat a+c", "x başka-kat b+c"]);
  });
});

describe("findSubstringTraps", () => {
  const target = question("t", { keyConcepts: [concept("a", ["slim", "-slim"]), concept("b", ["window", "pencere"]), concept("c", ["gama", "gamma"])] });
  const answers = [{ id: "o", text: "paket teslim edilir, windows da var" }];

  it("kelime ortasındaki eşleşmeyi tuzak sayar, noktalamayla başlayanı saymaz", () => {
    const traps = findSubstringTraps(target, answers, false);
    expect(traps.map((trap) => `${trap.alias}: ${trap.inside.map((hit) => hit.word).join(",")}`)).toEqual(["slim: teslim"]);
  });

  it("önek eşleşmesini yalnızca istenince listeler", () => {
    const traps = findSubstringTraps(target, answers, true);
    expect(traps.map((trap) => `${trap.alias}: ${trap.prefix.map((hit) => hit.word).join(",")}`)).toEqual(["slim: ", "window: windows"]);
  });
});

describe("diffLines", () => {
  it("sıradan bağımsız kalkan ve gelen satırları verir", () => {
    expect(diffLines(["a", "b", "c"], ["c", "d", "a"])).toEqual({ removed: ["b"], added: ["d"] });
  });
});

describe("overlay", () => {
  it("aynı id'yi yerinde değiştirir, yeni id'yi sona ekler", () => {
    const edited = question("b", { topic: "Join" });
    const result = overlay([question("a"), question("b")], [edited, question("c")]);
    expect(result.map((q) => `${q.id}:${q.topic}`)).toEqual(["a:Index", "b:Join", "c:Index"]);
  });
});

describe("parseArgs", () => {
  it("kategori ve düzenleme listelerini ayırır", () => {
    const options = parseArgs(["--category", "sql,web", "--edits", "a.json", "-v"]);
    expect(options).toMatchObject({ edits: ["a.json"], verbose: true, prefix: false, base: undefined });
    expect("categories" in options && [...(options.categories ?? [])]).toEqual(["sql", "web"]);
  });

  it("bilinmeyen seçeneği, kategoriyi ve eksik değeri reddeder", () => {
    expect(parseArgs(["--categry", "sql"])).toEqual({ error: "bilinmeyen seçenek: --categry" });
    expect(parseArgs(["--category", "sqll"])).toMatchObject({ error: expect.stringContaining("bilinmeyen kategori: sqll") });
    expect(parseArgs(["--base"])).toEqual({ error: "--base bir değer ister" });
  });
});

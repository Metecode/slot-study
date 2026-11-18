import { describe, expect, it } from "vitest";

import {
  ABSOLUTE_FLOOR,
  MARGIN,
  collectDecoyAnchors,
  evaluateLexical,
  evaluateSemantic,
  normalizeTr,
  splitSentences,
} from "./evaluate";
import type { KeyConcept, Question } from "./question";

function makeConcept(over: Partial<KeyConcept> = {}): KeyConcept {
  return {
    id: "kavram-1",
    label: "Kavram 1",
    aliases: ["birinci kavram"],
    anchors: ["Birinci kavramı anlatan yeterince uzun bir çapa cümlesi."],
    ...over,
  };
}

function makeQuestion(over: Partial<Question> = {}): Question {
  return {
    id: "q1",
    category: "sql",
    kind: "definition",
    topic: "Index",
    difficulty: 1,
    prompt: "Test sorusu",
    modelAnswer: "Yeterince uzun bir örnek cevap metni.",
    keyConcepts: [
      makeConcept({ id: "kavram-1", aliases: ["sirali erisim"] }),
      makeConcept({ id: "kavram-2", aliases: ["b-tree"] }),
    ],
    ...over,
  };
}

describe("normalizeTr", () => {
  it("Türkçe karakterleri sadeleştirir", () => {
    expect(normalizeTr("İstanbul Şişli Öğrenci Çığlık Üzüm")).toBe(
      "istanbul sisli ogrenci ciglik uzum",
    );
  });

  it("büyük harfli Türkçe I'yı doğru küçültür", () => {
    // Türkçe olmayan toLowerCase "IŞIK" -> "ışık" değil "i̇şi̇k" gibi bozuk sonuç verir.
    expect(normalizeTr("IŞIK")).toBe("isik");
  });

  it("fazla boşluğu temizler", () => {
    expect(normalizeTr("  çok   boşluklu   metin  ")).toBe("cok bosluklu metin");
  });

  it("kelime içi tire ve alt çizgiyi boşluğa çevirir", () => {
    expect(normalizeTr("health-check")).toBe("health check");
    expect(normalizeTr("health_check")).toBe("health check");
    expect(normalizeTr("health check")).toBe("health check");
    expect(normalizeTr("health -- check")).toBe("health -- check");
    expect(normalizeTr("Read--Only")).toBe("read only");
    expect(normalizeTr("e-posta")).toBe("e posta");
  });

  it("bitişik yazım ayrı kalır, iki yazım gerekiyorsa ikisi de alias olur", () => {
    expect(normalizeTr("healthcheck")).toBe("healthcheck");
    expect(normalizeTr("healthcheck")).not.toBe(normalizeTr("health check"));
  });

  it("baştaki ve sondaki işaretleri korur", () => {
    expect(normalizeTr("-p 8080:80")).toBe("-p 8080:80");
    expect(normalizeTr("sh -c")).toBe("sh -c");
    expect(normalizeTr("copy --from")).toBe("copy --from");
    expect(normalizeTr("-?")).toBe("-?");
    expect(normalizeTr("__html")).toBe("__html");
    expect(normalizeTr("__Host-")).toBe("__host-");
  });
});

describe("evaluateLexical — yazım ayırıcıları", () => {
  const question = makeQuestion({
    keyConcepts: [
      makeConcept({ id: "tireli", aliases: ["health-check"] }),
      makeConcept({ id: "bosluklu", aliases: ["service healthy"] }),
      makeConcept({ id: "bayrak", aliases: ["-p 8080"] }),
    ],
  });

  it.each(["health-check", "health_check", "health check"])("tireli alias %s yazımını tutar", (answer) => {
    expect(evaluateLexical(question, answer).hits).toContain("tireli");
  });

  it("boşluklu alias alt çizgili cevabı tutar", () => {
    expect(evaluateLexical(question, "condition: service_healthy").hits).toContain("bosluklu");
  });

  it("bitişik yazım tireli alias'ı tutmaz", () => {
    expect(evaluateLexical(question, "healthcheck").hits).not.toContain("tireli");
  });

  it("baştaki tireli bayrak yalnızca bayrakla eşleşir", () => {
    expect(evaluateLexical(question, "docker run -p 8080:80").hits).toContain("bayrak");
    expect(evaluateLexical(question, "port 8080").hits).not.toContain("bayrak");
  });
});

describe("evaluateLexical", () => {
  it("alias geçen kavramları yakalar, geçmeyeni kaçırır", () => {
    const question = makeQuestion();

    const result = evaluateLexical(question, "burada yalnızca sirali erisim var");

    expect(result.source).toBe("lexical");
    expect(result.hits).toEqual(["kavram-1"]);
    expect(result.missing).toEqual(["kavram-2"]);
  });

  it("boş cevapta hiçbir kavram yakalanmaz", () => {
    const result = evaluateLexical(makeQuestion(), "");

    expect(result.hits).toEqual([]);
    expect(result.missing).toEqual(["kavram-1", "kavram-2"]);
  });

  it("Türkçe normalizasyonla eşleşir", () => {
    const question = makeQuestion({
      keyConcepts: [makeConcept({ id: "k", aliases: ["gömme yuva"] })],
    });

    const result = evaluateLexical(question, "GÖMME YUVA içinde saklanır");

    expect(result.hits).toEqual(["k"]);
  });
});

describe("evaluateSemantic — yem havuzu yokken (baseline null, mutlak eşik)", () => {
  it("mutlak eşik üstündeki skoru yakalar", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(
      question,
      "cevap metni",
      { "kavram-1": ABSOLUTE_FLOOR + 0.01, "kavram-2": 0.1 },
      null,
    );

    expect(result.source).toBe("semantic");
    expect(result.hits).toEqual(["kavram-1"]);
    expect(result.missing).toEqual(["kavram-2"]);
  });

  it("mutlak eşiğe tam eşit ya da altındaki skoru kaçırılmış sayar", () => {
    const question = makeQuestion();

    // Eşitlik yakalamaz: karşılaştırma kesin büyüklük (>), büyük-eşit değil.
    const result = evaluateSemantic(
      question,
      "cevap metni",
      { "kavram-1": ABSOLUTE_FLOOR, "kavram-2": 0 },
      null,
    );

    expect(result.hits).toEqual([]);
    expect(result.missing).toEqual(["kavram-1", "kavram-2"]);
  });

  it("skoru eksik kavramı 0 sayar", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(question, "cevap metni", { "kavram-1": 0.9 }, null);

    expect(result.hits).toEqual(["kavram-1"]);
    expect(result.missing).toEqual(["kavram-2"]);
  });

  it("boş cevapta skorlar yüksek olsa bile hiçbir şey yakalanmaz", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(
      question,
      "   ",
      { "kavram-1": 0.99, "kavram-2": 0.99 },
      null,
    );

    expect(result.hits).toEqual([]);
    expect(result.missing).toEqual(["kavram-1", "kavram-2"]);
    expect(result.confidence).toBeUndefined();
  });

  it("confidence en düşük yakalanan skordur", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(
      question,
      "cevap metni",
      { "kavram-1": 0.95, "kavram-2": 0.85 },
      null,
    );

    expect(result.confidence).toBe(0.85);
  });

  it("hiçbir kavram yakalanmazsa confidence tanımsızdır", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(
      question,
      "cevap metni",
      { "kavram-1": 0.1, "kavram-2": 0.2 },
      null,
    );

    expect(result.confidence).toBeUndefined();
  });

  it("her kavramın ham skorunu döndürür (geliştirme aracı içindir)", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(
      question,
      "cevap metni",
      { "kavram-1": 0.95, "kavram-2": 0.2 },
      null,
    );

    expect(result.scores).toEqual({ "kavram-1": 0.95, "kavram-2": 0.2 });
  });

  it("baseline null geldiğinde Evaluation'da baseline tanımsızdır", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(question, "cevap metni", { "kavram-1": 0.95 }, null);

    expect(result.baseline).toBeUndefined();
  });
});

describe("evaluateSemantic — yem havuzu varken (karşılaştırmalı eşik)", () => {
  it("mutlak eşiği geçse de baseline + pay'ı geçmeyen skoru kaçırılmış sayar", () => {
    const question = makeQuestion();
    const baseline = 0.85;

    // Mutlak eşiğin (0.8) üstünde ama baseline + MARGIN'in (0.87) altında.
    const result = evaluateSemantic(
      question,
      "cevap metni",
      { "kavram-1": 0.86, "kavram-2": 0 },
      baseline,
    );

    expect(result.hits).toEqual([]);
    expect(result.missing).toEqual(["kavram-1", "kavram-2"]);
  });

  it("hem mutlak eşiği hem baseline + pay'ı geçen skoru yakalar", () => {
    const question = makeQuestion();
    const baseline = 0.85;

    const result = evaluateSemantic(
      question,
      "cevap metni",
      { "kavram-1": baseline + MARGIN + 0.01, "kavram-2": 0 },
      baseline,
    );

    expect(result.hits).toEqual(["kavram-1"]);
  });

  it("baseline düşükken mutlak eşik yine de devrede kalır", () => {
    const question = makeQuestion();
    const baseline = 0.3;

    // baseline + MARGIN'i rahatça geçer ama mutlak eşiğin (0.8) altında.
    const result = evaluateSemantic(
      question,
      "cevap metni",
      { "kavram-1": 0.5, "kavram-2": 0 },
      baseline,
    );

    expect(result.hits).toEqual([]);
  });

  it("Evaluation'a baseline'ı olduğu gibi ekler", () => {
    const question = makeQuestion();

    const result = evaluateSemantic(question, "cevap metni", { "kavram-1": 0.95 }, 0.85);

    expect(result.baseline).toBe(0.85);
  });
});

describe("collectDecoyAnchors", () => {
  function makeDecoyQuestion(id: string, category: Question["category"] = "sql"): Question {
    return makeQuestion({
      id,
      category,
      keyConcepts: [
        makeConcept({ id: `${id}-k1`, anchors: [`${id} için birinci çapa cümlesi burada.`] }),
        makeConcept({ id: `${id}-k2`, anchors: [`${id} için ikinci çapa cümlesi burada.`] }),
      ],
    });
  }

  it("yalnızca aynı kategorideki diğer soruların çapalarını toplar", () => {
    const question = makeQuestion({ id: "q1", category: "sql" });
    const sameCategory = makeDecoyQuestion("q2", "sql");
    const otherCategory = makeDecoyQuestion("q3", "react");

    const decoys = collectDecoyAnchors(question, [question, sameCategory, otherCategory]);

    expect(decoys).toEqual([
      "q2 için birinci çapa cümlesi burada.",
      "q2 için ikinci çapa cümlesi burada.",
    ]);
  });

  it("kendi sorusunun çapalarını yem saymaz", () => {
    const question = makeQuestion({ id: "q1", category: "sql" });

    const decoys = collectDecoyAnchors(question, [question]);

    expect(decoys).toEqual([]);
  });

  it("aynı kategoride başka soru yoksa boş döner", () => {
    const question = makeQuestion({ id: "q1", category: "sql" });
    const otherCategory = makeDecoyQuestion("q2", "react");

    const decoys = collectDecoyAnchors(question, [question, otherCategory]);

    expect(decoys).toEqual([]);
  });

  it("en fazla verilen limit kadar cümle döner", () => {
    const question = makeQuestion({ id: "q1", category: "sql" });
    const decoyQuestions = Array.from({ length: 5 }, (_, i) => makeDecoyQuestion(`q${i + 2}`));

    const decoys = collectDecoyAnchors(question, [question, ...decoyQuestions], 3);

    expect(decoys).toHaveLength(3);
  });

  it("varsayılan limit 20'dir", () => {
    const question = makeQuestion({ id: "q1", category: "sql" });
    const decoyQuestions = Array.from({ length: 15 }, (_, i) => makeDecoyQuestion(`q${i + 2}`));

    const decoys = collectDecoyAnchors(question, [question, ...decoyQuestions]);

    // 15 soru * 2 kavram * 1 çapa = 30 aday, 20'de kesilir.
    expect(decoys).toHaveLength(20);
  });
});

describe("splitSentences", () => {
  it("boş metinde hiç cümle döndürmez", () => {
    expect(splitSentences("")).toEqual([]);
  });

  it("noktalamasız tek cümleyi olduğu gibi döndürür", () => {
    expect(splitSentences("noktasız tek cümle")).toEqual(["noktasız tek cümle"]);
  });

  it("çok cümleli metni noktalama sınırından böler", () => {
    const result = splitSentences("Birinci cümle. İkinci cümle! Üçüncü cümle?");

    expect(result).toEqual(["Birinci cümle.", "İkinci cümle!", "Üçüncü cümle?"]);
  });

  it("cümleler arası fazla boşluğu temizler", () => {
    const result = splitSentences("Birinci.    İkinci.");

    expect(result).toEqual(["Birinci.", "İkinci."]);
  });
});

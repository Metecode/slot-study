import { describe, expect, it } from "vitest";

import { AVAILABLE_CATEGORIES, QUESTIONS } from "../content";
import { drawQuestion } from "./draw";
import type { Category, Question } from "./question";
import {
  FACES,
  WINNING_FACE,
  buildFaces,
  buildReelLayout,
  pairOf,
  restingPair,
} from "./reels";
import type { ReelColumn, ReelLayout, ReelPair } from "./reels";

/** Tekrarlanabilir rastgelelik: başarısız bir tohum aynı sonucu yeniden üretir. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeQuestion(id: string, category: Category, topic: string): Question {
  return {
    id,
    category,
    kind: "definition",
    topic,
    difficulty: 1,
    prompt: `${id} için soru metni`,
    modelAnswer: "Yeterince uzun bir örnek cevap metni.",
    keyConcepts: [],
  };
}

/** Ödeme çizgisindeki değer: dönüyorsa kazanan yüz, donmuşsa tek değer. */
function payline<T>(column: ReelColumn<T>): T | null {
  return column.kind === "spin" ? column.faces[WINNING_FACE] : column.value;
}

/** Kazananın şeritte hemen üstünde ve altında duran yüzler. */
function neighbors<T>(column: ReelColumn<T>): T[] {
  if (column.kind === "frozen") return [];
  return [column.faces[WINNING_FACE - 1], column.faces[WINNING_FACE + 1]];
}

function poolOf(categories: readonly Category[]): Question[] {
  return QUESTIONS.filter((q) => categories.includes(q.category));
}

function topicsOf(pool: readonly Question[], category: Category): Set<string> {
  return new Set(pool.filter((q) => q.category === category).map((q) => q.topic));
}

/** Rastgele, boş olmayan bir kategori alt kümesi. */
function randomSelection(rng: () => number): Category[] {
  const picked = AVAILABLE_CATEGORIES.filter(() => rng() < 0.5);
  return picked.length > 0
    ? picked
    : [AVAILABLE_CATEGORIES[Math.floor(rng() * AVAILABLE_CATEGORIES.length)]];
}

/** Ödeme çizgisi ve görünen komşular çekilen soruyla ve filtreyle tutarlı mı. */
function expectConsistent(layout: ReelLayout, question: Question, pool: readonly Question[]) {
  const active = new Set(pool.map((q) => q.category));
  const poolTopics = new Set(pool.map((q) => q.topic));

  expect(layout.pair).toEqual(pairOf(question));
  expect(payline(layout.category)).toBe(question.category);
  expect(payline(layout.topic)).toBe(question.topic);
  // Ödeme çizgisindeki çift havuzda gerçekten var olan bir soruya karşılık gelir.
  expect(pool.some((q) => q.category === question.category && q.topic === question.topic)).toBe(
    true,
  );

  // Filtre dışı hiçbir yüz yok.
  if (layout.category.kind === "spin") {
    for (const face of layout.category.faces) expect(active.has(face)).toBe(true);
  }
  if (layout.topic.kind === "spin") {
    for (const face of layout.topic.faces) expect(poolTopics.has(face)).toBe(true);
  }

  // Kategoride yeterince konu varsa üst/alt komşular da o kategoriden.
  const own = topicsOf(pool, question.category);
  if (own.size >= 3) {
    for (const face of neighbors(layout.topic)) {
      expect(own.has(face)).toBe(true);
      expect(face).not.toBe(question.topic);
    }
  }
}

describe("çekiliş ile tambur düzeni tutarlılığı", () => {
  it("çok sayıda rastgele çekişte hiçbir uyumsuz kategori–konu eşleşmesi yok", () => {
    const rng = seeded(20261006);
    let recentIds: string[] = [];

    for (let round = 0; round < 3000; round++) {
      const activeCategories = randomSelection(rng);
      const pool = poolOf(activeCategories);
      const question = drawQuestion({
        questions: QUESTIONS,
        progress: {},
        activeCategories,
        recentIds,
        now: new Date("2026-10-06T12:00:00.000Z"),
        rng,
      });

      expect(question).not.toBeNull();
      if (!question) return;
      expect(activeCategories).toContain(question.category);

      expectConsistent(buildReelLayout(pool, pairOf(question), rng), question, pool);
      recentIds = [...recentIds, question.id].slice(-10);
    }
  });

  it("filtre değişince boştaki tambur yeni filtrede var olan bir çifte geçer", () => {
    const rng = seeded(7);
    let previous: ReelPair | null = null;

    for (let round = 0; round < 1000; round++) {
      const pool = poolOf(randomSelection(rng));
      const pair = restingPair(pool, previous);
      expect(pair).not.toBeNull();
      if (!pair) return;

      const layout = buildReelLayout(pool, pair, rng);
      expect(payline(layout.category)).toBe(pair.category);
      expect(payline(layout.topic)).toBe(pair.topic);
      expect(pool.some((q) => q.category === pair.category && q.topic === pair.topic)).toBe(true);
      previous = pair;
    }
  });
});

describe("restingPair", () => {
  const react = makeQuestion("r1", "react", "props.children");
  const security = makeQuestion("c1", "cybersecurity", "JWT Saklama (XSS)");

  it("ekrandaki çift havuzda kaldıysa aynı nesneyi döndürür", () => {
    const shown = pairOf(react);
    expect(restingPair([security, react], shown)).toBe(shown);
  });

  it("filtre ekrandaki çifti dışarıda bıraktıysa havuzdan birine geçer", () => {
    // Hatanın kendisi: React'tan Siber Güvenlik'e geçince "props.children" kalıyordu.
    expect(restingPair([security], pairOf(react))).toEqual(pairOf(security));
  });

  it("aynı adlı konu başka kategorideyse çifti geçerli saymaz", () => {
    const sqlSecurity = makeQuestion("s1", "sql", "Güvenlik");
    const reactSecurity = makeQuestion("r2", "react", "Güvenlik");
    expect(restingPair([sqlSecurity], pairOf(reactSecurity))).toEqual(pairOf(sqlSecurity));
  });

  it("havuz boşsa null", () => {
    expect(restingPair([], pairOf(react))).toBeNull();
  });
});

describe("buildReelLayout — kenar durumlar", () => {
  const rng = seeded(1);

  it("tek kategori seçiliyken kategori tamburu o kategoride donar", () => {
    const pool = poolOf(["react"]);
    const question = pool[0];
    const layout = buildReelLayout(pool, pairOf(question), rng);

    expect(layout.category).toEqual({ kind: "frozen", value: "react" });
    expect(layout.topic.kind).toBe("spin");
    expectConsistent(layout, question, pool);
  });

  it("tek konulu kategori: kazanan doğru, konu tamburu yine döner", () => {
    const pool = [
      makeQuestion("j1", "javascript", "null ve undefined"),
      makeQuestion("d1", "docker", "Ağ"),
      makeQuestion("d2", "docker", "Compose"),
    ];
    const layout = buildReelLayout(pool, pairOf(pool[0]), rng);

    // Sol durmadan konu görünmesin diye donma kararı tüm havuza bakar.
    expect(layout.topic.kind).toBe("spin");
    expect(payline(layout.topic)).toBe("null ve undefined");
    for (const face of neighbors(layout.topic)) expect(face).not.toBe("null ve undefined");
  });

  it("iki konulu kategoride kardeş konu komşulardan birine yerleşir", () => {
    const pool = poolOf(["cybersecurity", "docker", "react"]);
    const question = pool.find((q) => q.category === "cybersecurity")!;
    const sibling = [...topicsOf(pool, "cybersecurity")].find((t) => t !== question.topic);

    for (let i = 0; i < 50; i++) {
      const layout = buildReelLayout(pool, pairOf(question), rng);
      expect(payline(layout.topic)).toBe(question.topic);
      expect(neighbors(layout.topic)).toContain(sibling);
    }
  });

  it("tek soruluk havuzda iki tambur da donar", () => {
    const only = makeQuestion("x1", "sql", "Index");
    const layout = buildReelLayout([only], pairOf(only), rng);

    expect(layout.category).toEqual({ kind: "frozen", value: "sql" });
    expect(layout.topic).toEqual({ kind: "frozen", value: "Index" });
  });

  it("çift yoksa (boş havuz) iki tambur da boş donar", () => {
    const layout = buildReelLayout([], null, rng);

    expect(layout.category).toEqual({ kind: "frozen", value: null });
    expect(layout.topic).toEqual({ kind: "frozen", value: null });
  });

  it("içeriği olmayan kategori seçiliyse çekiliş de boştaki çift de boş", () => {
    // CATEGORIES'te var, içeriği henüz yok: havuza soru katmaz.
    const activeCategories: Category[] = ["kafka-redis"];
    const pool = poolOf(activeCategories);

    expect(pool).toHaveLength(0);
    expect(
      drawQuestion({
        questions: QUESTIONS,
        progress: {},
        activeCategories,
        recentIds: [],
        now: new Date(),
        rng,
      }),
    ).toBeNull();
    expect(restingPair(pool, null)).toBeNull();
  });

  it("cevap ekranındayken filtre soruyu dışarıda bırakırsa soru yine gösterilir", () => {
    const question = poolOf(["react"])[0];
    const pool = poolOf(["cybersecurity"]);
    const layout = buildReelLayout(pool, pairOf(question), rng);

    expect(payline(layout.category)).toBe("react");
    expect(payline(layout.topic)).toBe(question.topic);
  });
});

describe("buildFaces", () => {
  it("kazananı sabit yerine koyar, yan yana tekrar üretmez", () => {
    const rng = seeded(3);
    const pool = ["a", "b", "c", "d", "e"];

    for (let i = 0; i < 200; i++) {
      const faces = buildFaces(pool, "c", rng);
      expect(faces).toHaveLength(FACES);
      expect(faces[WINNING_FACE]).toBe("c");
      for (let j = 0; j < FACES; j++) {
        expect(faces[j]).not.toBe(faces[(j + 1) % FACES]);
      }
    }
  });

  it("kazananın komşularını öncelikli havuzdan seçer", () => {
    const rng = seeded(4);
    const pool = ["a", "b", "c", "x", "y", "z"];
    const preferred = ["a", "b", "c"];

    for (let i = 0; i < 200; i++) {
      const faces = buildFaces(pool, "a", rng, preferred);
      expect(["b", "c"]).toContain(faces[WINNING_FACE - 1]);
      expect(["b", "c"]).toContain(faces[WINNING_FACE + 1]);
    }
  });
});

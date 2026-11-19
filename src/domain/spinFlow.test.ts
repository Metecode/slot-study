import { describe, expect, it } from "vitest";

import type { Category, Question } from "./question";
import { buildReelLayout, pairOf, WINNING_FACE } from "./reels";
import type { ReelColumn } from "./reels";
import { initialSessionState, sessionReducer } from "./session";
import type { SessionAction, SessionState } from "./session";
import { spinPlanFor } from "./spinTiming";
import { spinStarted } from "./spinStart";

/* ------------------------------------------------------------------ */
/* Dönüş akışı — mod ve atlama sonucu ve ölçümü değiştirmez             */
/*                                                                     */
/* Mod ve atlama yalnızca SETTLE'ın ne kadar erken geldiğini değiştirir. */
/* useTurnFlow her render'da spinStarted(önceki, şimdiki) ile bakar; en  */
/* kötü durum her eylemden sonraki state'in ayrı ayrı görülmesi, burada  */
/* öyle sayılıyor. SPIN ile SETTLE aynı render'a birleşemez: SETTLE'ı    */
/* tambur, spinKey arttıktan sonra (Kapalı modda layout efektinde,       */
/* atlamada onfinish'te) gönderir.                                      */
/* ------------------------------------------------------------------ */

function question(id: string, category: Category, topic: string): Question {
  return {
    id,
    category,
    kind: "definition",
    topic,
    difficulty: 1,
    origin: { kind: "own" },
    prompt: `${id} için soru metni`,
    modelAnswer: "Yeterince uzun bir örnek cevap metni.",
    keyConcepts: [],
  };
}

const QUESTIONS: Question[] = [
  question("s1", "sql", "Index"),
  question("s2", "sql", "Transaction"),
  question("s3", "sql", "Join"),
  question("r1", "react", "Hooks"),
  question("r2", "react", "State"),
  question("j1", "java", "Temeller"),
];

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

function startState(): SessionState {
  return { ...initialSessionState(), activeCategories: ["sql", "react", "java"] };
}

const NOW = new Date("2026-11-19T12:00:00.000Z");
const spin = (seed = 1): SessionAction => ({ type: "SPIN", questions: QUESTIONS, now: NOW, rng: seeded(seed) });
const SETTLE: SessionAction = { type: "SETTLE" };
const PASS: SessionAction = { type: "PASS" };
const rate: SessionAction = { type: "RATE", rating: 2, answer: "", now: NOW };

/** Eylemleri sırayla uygular; her eylemden sonraki state'i useTurnFlow'un efekti gibi görür. */
function run(actions: SessionAction[], state = startState()) {
  let previous = state.phase;
  let spins = 0;
  for (const action of actions) {
    state = sessionReducer(state, action);
    if (spinStarted(previous, state.phase)) spins++;
    previous = state.phase;
  }
  return { state, spins };
}

/** Bir modun bir turu: dönüş sürerken birkaç render, sonra iki tamburun oturması. */
function turnFor(mode: "full" | "short" | "off", spinIndex: number, skipped: boolean): SessionAction[] {
  const plan = spinPlanFor(mode, spinIndex);
  // Animasyonlu dönüşte ara render'lar (spinKey, tık, düzen) faz değiştirmez.
  const renders: SessionAction[] = plan.reelsAnimated && !skipped ? [{ type: "TOGGLE_CATEGORY", category: "sql" }] : [];
  // Machine iki tamburun duruşunu da bildirebilir; ikincisi reducer'da yok sayılır.
  return [spin(spinIndex), ...renders, SETTLE, SETTLE, PASS, rate];
}

describe("spin olayı", () => {
  for (const mode of ["full", "short", "off"] as const) {
    for (const skipped of [false, true]) {
      it(`${mode}${skipped ? " + atlama" : ""}: her tur tam olarak bir kez`, () => {
        const turns = [1, 2, 3].flatMap((index) => turnFor(mode, index, skipped));
        expect(run(turns).spins).toBe(3);
      });
    }
  }

  it("art arda dokunuş: reddedilen ikinci SPIN yeni bir olay değil", () => {
    expect(run([spin(1), spin(2), spin(3), SETTLE]).spins).toBe(1);
  });

  it("dönüş sürerken tekrar görülen spinning yeni bir dönüş değil", () => {
    expect(spinStarted("spinning", "spinning")).toBe(false);
    expect(spinStarted("idle", "spinning")).toBe(true);
    expect(spinStarted("evaluated", "spinning")).toBe(true);
    expect(spinStarted("spinning", "answering")).toBe(false);
  });

  it("havuz boşken reddedilen çekiliş olay göndermez", () => {
    const empty = { ...startState(), activeCategories: [] as Category[] };
    expect(run([spin(1)], empty).spins).toBe(0);
  });
});

describe("atlama sonucu değiştirmez", () => {
  it("aynı çekişte atlanan ve sonuna kadar oynayan dönüş aynı soruyu açar", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const drawn = sessionReducer(startState(), spin(seed)).current;
      const played = run([spin(seed), { type: "TOGGLE_CATEGORY", category: "sql" }, SETTLE]).state;
      const skipped = run([spin(seed), SETTLE, SETTLE]).state;

      expect(drawn).not.toBeNull();
      expect(played.phase).toBe("answering");
      expect(skipped.phase).toBe("answering");
      expect(skipped.current).toBe(drawn);
      expect(played.current).toBe(drawn);
    }
  });

  it("tamburun ödeme çizgisi çekilen soruyu gösterir; düzen animasyon süresine bağlı değil", () => {
    const drawn = sessionReducer(startState(), spin(7)).current;
    if (!drawn) throw new Error("çekiliş boş");
    const layout = buildReelLayout(QUESTIONS, pairOf(drawn), seeded(7));

    const payline = <T,>(column: ReelColumn<T>) => (column.kind === "spin" ? column.faces[WINNING_FACE] : column.value);
    expect(payline(layout.category)).toBe(drawn.category);
    expect(payline(layout.topic)).toBe(drawn.topic);
  });
});

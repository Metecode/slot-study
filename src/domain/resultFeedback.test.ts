import { describe, expect, it } from "vitest";

import { createFeedbackGate } from "./resultFeedback";
import { RESULT_FEEDBACK_GAP_MS, spinPlanFor } from "./spinTiming";

/** Bir çekişte iki tamburun duruş anlarını kapıdan geçirir; kaç sonuç sesi çaldığını sayar. */
function playedFor(stopTimes: number[]): number {
  const gate = createFeedbackGate(RESULT_FEEDBACK_GAP_MS);
  return stopTimes.filter((at) => gate(at)).length;
}

describe("createFeedbackGate", () => {
  it("atlamada iki tambur aynı karede durur: ses ve titreşim bir kez", () => {
    // finish() iki animasyonu aynı anda bitirir; onfinish olayları birkaç ms arayla düşer.
    expect(playedFor([1000, 1000])).toBe(1);
    expect(playedFor([1000, 1004])).toBe(1);
  });

  it("Kapalı modda iki tambur anında durur: bir kez", () => {
    const plan = spinPlanFor("off", 2);
    expect(playedFor([plan.left.durationMs, plan.right.durationMs])).toBe(1);
  });

  it("Tam ve Kısa'da sol ve sağın ayrı duruşları ayrı duyulur", () => {
    for (const mode of ["full", "short"] as const) {
      const plan = spinPlanFor(mode, 2);
      expect(playedFor([plan.left.durationMs, plan.right.durationMs])).toBe(2);
    }
  });

  it("sol durduktan sonra sağ atlanırsa sağın sesi de çalar (ikinci bir duruş)", () => {
    expect(playedFor([455, 455 + 200])).toBe(2);
  });

  it("sonraki çekişin duruşları öncekinden etkilenmez", () => {
    const gate = createFeedbackGate(RESULT_FEEDBACK_GAP_MS);
    expect([gate(0), gate(2), gate(5000), gate(5003)]).toEqual([true, false, true, false]);
  });
});

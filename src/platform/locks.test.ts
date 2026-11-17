import { describe, expect, it } from "vitest";

import { withLock } from "./locks";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("withLock", () => {
  it("aynı addaki oku-değiştir-yaz adımlarını sıraya sokar", async () => {
    let stored = 0;
    const increment = () =>
      withLock("sayac", async () => {
        const read = stored;
        await tick();
        stored = read + 1;
      });

    await Promise.all([increment(), increment(), increment()]);

    expect(stored).toBe(3);
  });

  it("hata çağırana döner, zincir sonraki çağrı için açık kalır", async () => {
    await expect(withLock("hata", () => Promise.reject(new Error("bozuk")))).rejects.toThrow("bozuk");
    await expect(withLock("hata", async () => "devam")).resolves.toBe("devam");
  });
});

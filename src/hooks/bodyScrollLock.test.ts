import { describe, expect, it } from "vitest";

import { createScrollLock } from "./bodyScrollLock";

/* Sahte ortam: body stili düz bir nesne, kaydırma konumu bir değişken. */
function fakeEnv(initialY: number) {
  const env = {
    y: initialY,
    scrollCalls: [] as number[],
    style: { position: "relative", top: "", width: "" },
    getScrollY: () => env.y,
    scrollTo: (y: number) => {
      env.scrollCalls.push(y);
      env.y = y;
    },
  };
  return env;
}

describe("createScrollLock", () => {
  it("body'yi kaydırma konumunda sabitler, kalkınca stili ve konumu geri yazar", () => {
    const env = fakeEnv(420);
    const lock = createScrollLock(env);

    const release = lock.acquire();
    expect(env.style).toEqual({ position: "fixed", top: "-420px", width: "100%" });

    release();
    expect(env.style).toEqual({ position: "relative", top: "", width: "" });
    expect(env.scrollCalls).toEqual([420]);
  });

  it("üst üste iki kilitte yalnızca sonuncusu kalkınca açılır, konum ilk kilitte kaydedilir", () => {
    const env = fakeEnv(300);
    const lock = createScrollLock(env);

    const releaseFirst = lock.acquire();
    // Body sabitken tarayıcı scrollY'yi 0 bildirir; ikinci kilit bunu okumamalı.
    env.y = 0;
    const releaseSecond = lock.acquire();
    expect(lock.count()).toBe(2);
    expect(env.style.top).toBe("-300px");

    releaseSecond();
    expect(env.style.position).toBe("fixed");
    expect(env.scrollCalls).toEqual([]);

    releaseFirst();
    expect(lock.count()).toBe(0);
    expect(env.style.position).toBe("relative");
    expect(env.scrollCalls).toEqual([300]);
  });

  it("kapanış sırası açılışın tersi olmasa da kilit doğru kalkar", () => {
    const env = fakeEnv(50);
    const lock = createScrollLock(env);

    const releaseFirst = lock.acquire();
    const releaseSecond = lock.acquire();
    releaseFirst();
    expect(env.style.position).toBe("fixed");
    releaseSecond();
    expect(env.style.position).toBe("relative");
    expect(env.scrollCalls).toEqual([50]);
  });

  it("aynı bırakma iki kez çağrılırsa sayaç eksiye düşmez", () => {
    const env = fakeEnv(10);
    const lock = createScrollLock(env);

    const releaseFirst = lock.acquire();
    const releaseSecond = lock.acquire();
    releaseSecond();
    releaseSecond();
    expect(lock.count()).toBe(1);
    expect(env.style.position).toBe("fixed");

    releaseFirst();
    expect(lock.count()).toBe(0);
  });

  it("kilit kalktıktan sonra yeniden alınınca yeni konumu kaydeder", () => {
    const env = fakeEnv(100);
    const lock = createScrollLock(env);

    lock.acquire()();
    env.y = 900;
    const release = lock.acquire();
    expect(env.style.top).toBe("-900px");
    release();
    expect(env.scrollCalls).toEqual([100, 900]);
  });
});

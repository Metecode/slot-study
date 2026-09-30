import { describe, expect, it } from "vitest";

import { createMemoryAdapter } from "./memoryAdapter";
import { toFlatKey } from "./StorageAdapter";

/* ------------------------------------------------------------------ */
/* Anahtar biçimi ve bellek gerçeklemesine özgü davranış               */
/* Ortak sözleşme: storageAdapterContract.test.ts                      */
/* ------------------------------------------------------------------ */

describe("toFlatKey", () => {
  it("mevcut kaydın anahtarını üretir", () => {
    // Web'deki kullanıcı verisi bu anahtarda; biçim değişirse veri okunmaz.
    expect(toFlatKey("mulakat-slot", "store")).toBe("mulakat-slot/store");
  });

  it("key içinde ayırıcıya izin verir", () => {
    expect(toFlatKey("ns", "a/b")).toBe("ns/a/b");
  });

  it("ayırıcı içeren ya da boş ns'i reddeder", () => {
    expect(() => toFlatKey("a/b", "c")).toThrow();
    expect(() => toFlatKey("", "c")).toThrow();
  });
});

describe("createMemoryAdapter", () => {
  // IndexedDB'nin tek transaction'ı namespace'leri de kapsıyor; dosya
  // gerçeklemesi bunu reddeder (bkz. filesystemAdapter.disk.test.ts).
  it("setMany birden çok namespace'e birlikte yazar", async () => {
    const storage = createMemoryAdapter();
    await storage.setMany([
      { ns: "a", key: "x", value: 1 },
      { ns: "b", key: "y", value: 2 },
    ]);

    expect(await storage.get("a", "x")).toBe(1);
    expect(await storage.get("b", "y")).toBe(2);
  });
});

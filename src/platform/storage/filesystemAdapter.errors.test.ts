import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeFs } from "./fakeFilesystem";
import { DIR, JSON_PATH, reopen, text, UNREADABLE } from "./filesystemTestSupport";
import { MAX_UNREADABLE_COPIES } from "./namespaceFile";

/* ------------------------------------------------------------------ */
/* Dosya deposu: okuma hatalarının ayrımı ve okunamayan dosya          */
/* Ortak sözleşme: storageAdapterContract.test.ts                      */
/* ------------------------------------------------------------------ */

vi.mock("@capacitor/filesystem", () => import("./fakeFilesystem"));

beforeEach(() => fakeFs.reset());

describe("okuma hataları", () => {
  it("'dosya yok' dışındaki hata iletilir ve önbelleğe alınmaz", async () => {
    fakeFs.files.set(JSON_PATH, text({ k: "değer" }));
    fakeFs.beforeCall = (method) => {
      if (method !== "readFile") return;
      fakeFs.beforeCall = undefined;
      throw new Error("okuma izni yok");
    };
    const storage = reopen();

    await expect(storage.get("ns", "k")).rejects.toThrow("okuma izni yok");
    expect(await storage.get("ns", "k")).toBe("değer");
  });
});

describe("okunamayan dosya", () => {
  it("her get ham metni, getAll boş liste döner", async () => {
    fakeFs.files.set(JSON_PATH, "{bozuk");
    const storage = reopen();

    expect(await storage.get("ns", "store")).toBe("{bozuk");
    expect(await storage.get("ns", "baska")).toBe("{bozuk");
    expect(await storage.getAll("ns")).toEqual([]);
  });

  it("ilk yazmadan önce dosyayı kenara taşır; yeni harita boş başlar", async () => {
    fakeFs.files.set(JSON_PATH, "{bozuk");
    const storage = reopen();
    await storage.set("ns", "yedek", "{bozuk");

    expect(fakeFs.files.get(UNREADABLE)).toBe("{bozuk");
    expect(fakeFs.files.get(JSON_PATH)).toBe(text({ yedek: "{bozuk" }));
    expect(await storage.get("ns", "store")).toBeUndefined();
  });

  it(`en fazla ${MAX_UNREADABLE_COPIES} kopya tutar, en eskisini siler`, async () => {
    const older = ["2026-04-01", "2026-04-02", "2026-04-03"].map((day) => `ns.json.unreadable-${day}T00-00-00.000Z`);
    for (const name of older) fakeFs.files.set(`${DIR}/${name}`, "eski");
    fakeFs.files.set(JSON_PATH, "{bozuk");

    await reopen().set("ns", "k", 1);

    const copies = [...fakeFs.files.keys()].filter((path) => path.includes(".unreadable-")).sort();
    expect(copies).toEqual([`${DIR}/${older[1]}`, `${DIR}/${older[2]}`, UNREADABLE]);
  });

  it("kenara taşıdıktan sonra yazma düşerse, sonraki yazma tekrar taşımaz", async () => {
    fakeFs.files.set(JSON_PATH, "{bozuk");
    const storage = reopen();
    fakeFs.beforeCall = (method) => {
      if (method !== "writeFile") return;
      fakeFs.beforeCall = undefined;
      throw new Error("disk dolu");
    };

    await expect(storage.set("ns", "k", 1)).rejects.toThrow("disk dolu");
    await storage.set("ns", "k", 2);

    expect(fakeFs.files.get(UNREADABLE)).toBe("{bozuk");
    expect(fakeFs.files.get(JSON_PATH)).toBe(text({ k: 2 }));
  });
});

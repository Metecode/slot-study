import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeFs } from "./fakeFilesystem";
import { JSON_PATH, reopen, text, TMP_PATH, writes } from "./filesystemTestSupport";

/* ------------------------------------------------------------------ */
/* Dosya deposu: yazma kuyruğu ve bellek önbelleği                     */
/* Ortak sözleşme: storageAdapterContract.test.ts                      */
/* ------------------------------------------------------------------ */

vi.mock("@capacitor/filesystem", () => import("./fakeFilesystem"));

beforeEach(() => fakeFs.reset());

describe("kuyruk", () => {
  it("ilk yazma yavaş olsa da çağrılar sırayla çalışır ve son çağrı diskte kalır", async () => {
    const storage = reopen();
    await storage.set("ns", "hazir", true);
    fakeFs.calls = [];
    // Kuyruk olmasaydı ikinci yazma önce biter, ilki onu ezerdi (emülatörde 5/5).
    let first = true;
    fakeFs.delayMs = (method) => {
      if (method !== "writeFile" || !first) return 0;
      first = false;
      return 30;
    };

    await Promise.all([storage.set("ns", "k", 1), storage.set("ns", "k", 2)]);

    expect(writes()).toEqual([
      `writeFile ${TMP_PATH}`,
      `rename ${TMP_PATH} -> ${JSON_PATH}`,
      `writeFile ${TMP_PATH}`,
      `rename ${TMP_PATH} -> ${JSON_PATH}`,
    ]);
    expect(JSON.parse(fakeFs.files.get(JSON_PATH) ?? "")).toEqual({ hazir: true, k: 2 });
  });
});

describe("yazma hataları", () => {
  it("rename hedefi silip düşerse: hata iletilir, bellek eskide kalır, yeniden açılış .tmp'den kurtarır", async () => {
    const storage = reopen();
    await storage.set("ns", "k", "eski");
    fakeFs.afterRenameDelete = () => {
      fakeFs.afterRenameDelete = undefined;
      throw new Error("süreç öldürüldü");
    };

    await expect(storage.set("ns", "k", "yeni")).rejects.toThrow("süreç öldürüldü");
    expect(await storage.get("ns", "k")).toBe("eski");
    expect(fakeFs.files.has(JSON_PATH)).toBe(false);

    expect(await reopen().get("ns", "k")).toBe("yeni");
  });

  it("writeFile düşerse disk ve bellek değişmez, kuyruk sonraki işlemle sürer", async () => {
    const storage = reopen();
    await storage.set("ns", "k", "eski");
    fakeFs.beforeCall = (method) => {
      if (method !== "writeFile") return;
      fakeFs.beforeCall = undefined;
      throw new Error("disk dolu");
    };

    await expect(storage.set("ns", "k", "yeni")).rejects.toThrow("disk dolu");
    expect(await storage.get("ns", "k")).toBe("eski");
    expect(fakeFs.files.get(JSON_PATH)).toBe(text({ k: "eski" }));

    await storage.set("ns", "k", "sonraki");
    expect(await reopen().get("ns", "k")).toBe("sonraki");
  });
});

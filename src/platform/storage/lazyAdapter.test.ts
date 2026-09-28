import { describe, expect, it, vi } from "vitest";

import { createLazyAdapter } from "./lazyAdapter";
import { createMemoryAdapter } from "./memoryAdapter";

/* ------------------------------------------------------------------ */
/* Tembel adapter — ilk çağrıda yükler, çağrıları aynen iletir         */
/* ------------------------------------------------------------------ */

describe("createLazyAdapter", () => {
  it("ilk çağrıya kadar yüklemez, sonra bir kez yükler", async () => {
    const load = vi.fn(() => Promise.resolve(createMemoryAdapter()));
    const storage = createLazyAdapter(load);
    expect(load).not.toHaveBeenCalled();

    await storage.set("ns", "k", 1);
    expect(await storage.get("ns", "k")).toBe(1);
    expect(await storage.getAll("ns")).toEqual([{ key: "k", value: 1 }]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("bütün metodları yüklenen gerçeklemeye iletir", async () => {
    const inner = createMemoryAdapter();
    const storage = createLazyAdapter(() => Promise.resolve(inner));

    await storage.setMany([{ ns: "ns", key: "a", value: 1 }]);
    await storage.set("ns", "b", 2);
    await storage.delete("ns", "a");
    expect(await inner.getAll("ns")).toEqual([{ key: "b", value: 2 }]);

    await storage.clear("ns");
    expect(await inner.get("ns", "b")).toBeUndefined();
    await storage.set("x", "k", 1);
    await storage.clear();
    expect(await inner.get("x", "k")).toBeUndefined();
  });

  it("yükleme düşerse hata iletilir, sonraki çağrı yeniden dener", async () => {
    const load = vi
      .fn<() => Promise<ReturnType<typeof createMemoryAdapter>>>()
      .mockRejectedValueOnce(new Error("chunk indirilemedi"))
      .mockResolvedValue(createMemoryAdapter());
    const storage = createLazyAdapter(load);

    await expect(storage.get("ns", "k")).rejects.toThrow("chunk indirilemedi");
    await expect(storage.get("ns", "k")).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

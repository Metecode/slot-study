import { expect, it } from "vitest";

import type { StorageAdapter } from "./StorageAdapter";

/* ------------------------------------------------------------------ */
/* StorageAdapter sözleşmesi — her gerçeklemede aynı testler           */
/* ------------------------------------------------------------------ */

/*
  describe.each içinden çağrılır (bkz. storageAdapterContract.test.ts).
  Yalnızca her gerçeklemenin sağlaması gerekenler burada; bir
  gerçeklemeye özgü davranış (dosyanın kurtarılması, çok namespace'li
  setMany) o gerçeklemenin kendi test dosyasında.
*/
export function storageAdapterContract(create: () => StorageAdapter): void {
  it("olmayan anahtar için undefined döner", async () => {
    const storage = create();
    expect(await storage.get("ns", "yok")).toBeUndefined();
  });

  it("yazılanı okur, namespace'ler birbirine karışmaz", async () => {
    const storage = create();
    await storage.set("a", "k", 1);
    await storage.set("b", "k", 2);

    expect(await storage.get("a", "k")).toBe(1);
    expect(await storage.get("b", "k")).toBe(2);
  });

  it("yazılan değerin kopyasını saklar, okunan değer de kopyadır", async () => {
    const storage = create();
    const value = { list: [1] };
    await storage.set("ns", "k", value);
    value.list.push(2);

    const read = await storage.get<{ list: number[] }>("ns", "k");
    expect(read).toEqual({ list: [1] });

    read?.list.push(3);
    expect(await storage.get("ns", "k")).toEqual({ list: [1] });
  });

  it("aynı anahtara yeniden yazmak öncekinin yerine geçer", async () => {
    const storage = create();
    await storage.set("ns", "k", "eski");
    await storage.set("ns", "k", "yeni");

    expect(await storage.get("ns", "k")).toBe("yeni");
  });

  it("beklemeden art arda yazmalarda son çağrı kazanır, okuma yazmayı görür", async () => {
    const storage = create();
    const writes = [storage.set("ns", "k", 1), storage.set("ns", "k", 2), storage.set("ns", "k", 3)];
    const read = storage.get("ns", "k");
    await Promise.all(writes);

    expect(await read).toBe(3);
    expect(await storage.get("ns", "k")).toBe(3);
  });

  it("getAll yalnızca o ns'in kayıtlarını, ns öneki olmadan döner", async () => {
    const storage = create();
    await storage.set("ns", "a", 1);
    await storage.set("ns", "b/c", 2);
    await storage.set("ns-baska", "a", 3);

    const all = await storage.getAll<number>("ns");
    expect(all).toEqual(
      expect.arrayContaining([
        { key: "a", value: 1 },
        { key: "b/c", value: 2 },
      ]),
    );
    expect(all).toHaveLength(2);
  });

  it("setMany tek namespace içinde hepsini yazar", async () => {
    const storage = create();
    await storage.set("ns", "eski", 0);
    await storage.setMany([
      { ns: "ns", key: "x", value: 1 },
      { ns: "ns", key: "y", value: 2 },
    ]);

    expect(await storage.get("ns", "x")).toBe(1);
    expect(await storage.get("ns", "y")).toBe(2);
    expect(await storage.get("ns", "eski")).toBe(0);
  });

  it("setMany girdilerden biri geçersizse hiçbirini yazmaz", async () => {
    const storage = create();
    await expect(
      storage.setMany([
        { ns: "a", key: "x", value: 1 },
        { ns: "gecersiz/ns", key: "y", value: 2 },
      ]),
    ).rejects.toThrow();

    expect(await storage.get("a", "x")).toBeUndefined();
  });

  it("geçersiz ns'i reddeder", async () => {
    const storage = create();
    await expect(storage.set("a/b", "k", 1)).rejects.toThrow();
    await expect(storage.get("", "k")).rejects.toThrow();
  });

  it("delete tek kaydı siler, olmayan kaydı silmek hata değildir", async () => {
    const storage = create();
    await storage.set("ns", "a", 1);
    await storage.set("ns", "b", 2);
    await storage.delete("ns", "a");
    await storage.delete("ns", "yok");

    expect(await storage.get("ns", "a")).toBeUndefined();
    expect(await storage.get("ns", "b")).toBe(2);
  });

  it("clear(ns) yalnızca o ns'i, clear() her şeyi siler", async () => {
    const storage = create();
    await storage.set("a", "k", 1);
    await storage.set("b", "k", 2);

    await storage.clear("a");
    expect(await storage.get("a", "k")).toBeUndefined();
    expect(await storage.get("b", "k")).toBe(2);

    await storage.clear();
    expect(await storage.get("b", "k")).toBeUndefined();
  });

  it("boş depoda clear hata vermez", async () => {
    const storage = create();
    await expect(storage.clear("ns")).resolves.toBeUndefined();
    await expect(storage.clear()).resolves.toBeUndefined();
  });
}

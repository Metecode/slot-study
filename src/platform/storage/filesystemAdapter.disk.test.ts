import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeFs } from "./fakeFilesystem";
import { DIR, half, JSON_PATH, reopen, text, TMP_PATH, UNREADABLE, writes } from "./filesystemTestSupport";

/* ------------------------------------------------------------------ */
/* Dosya deposu: disk düzeni ve öldürülme sonrası kurtarma             */
/* Ortak sözleşme: storageAdapterContract.test.ts                      */
/* ------------------------------------------------------------------ */

vi.mock("@capacitor/filesystem", () => import("./fakeFilesystem"));

beforeEach(() => fakeFs.reset());

describe("disk düzeni", () => {
  it("tüm haritayı .tmp'ye yazar, sonra .json'a taşır", async () => {
    const storage = reopen();
    await storage.set("ns", "a", 1);

    expect(writes()).toEqual([`writeFile ${TMP_PATH}`, `rename ${TMP_PATH} -> ${JSON_PATH}`]);
    expect(fakeFs.files.get(JSON_PATH)).toBe(text({ a: 1 }));
    expect(fakeFs.files.has(TMP_PATH)).toBe(false);
  });

  it("yeniden açılışta diskteki veriyi okur", async () => {
    await reopen().set("ns", "a", { list: [1, 2] });
    expect(await reopen().get("ns", "a")).toEqual({ list: [1, 2] });
  });
});

describe("öldürülme sonrası açılış: önce .tmp", () => {
  const eski = text({ k: "eski" });
  const yeni = text({ k: "yeni" });

  it.each([
    [".tmp yazılırken: yarım .tmp atlanır, eski .json okunur", { json: eski, tmp: half(yeni) }, "eski"],
    [".tmp bitti, .json silinmeden: son yazma .tmp'den gelir", { json: eski, tmp: yeni }, "yeni"],
    [".json silindi, taşınmadan: yalnız .tmp kaldı", { tmp: yeni }, "yeni"],
    ["Android'in kopya yedeği yarıda: yarım .json, tam .tmp", { json: half(yeni), tmp: yeni }, "yeni"],
    ["ilk yazma yarıda: .json hiç yok, yarım .tmp", { tmp: half(yeni) }, undefined],
  ])("%s", async (_name, disk: { json?: string; tmp?: string }, expected) => {
    if (disk.json !== undefined) fakeFs.files.set(JSON_PATH, disk.json);
    if (disk.tmp !== undefined) fakeFs.files.set(TMP_PATH, disk.tmp);

    const storage = reopen();
    expect(await storage.get("ns", "k")).toBe(expected);

    // Sonraki yazma diski toparlar: tek, geçerli bir .json kalır.
    await storage.set("ns", "sonra", true);
    expect(fakeFs.files.has(TMP_PATH)).toBe(false);
    expect(JSON.parse(fakeFs.files.get(JSON_PATH) ?? "")).toEqual(
      expected === undefined ? { sonra: true } : { k: expected, sonra: true },
    );
  });
});

describe("setMany", () => {
  it("tek namespace'i tek yazmada yazar", async () => {
    await reopen().setMany([
      { ns: "ns", key: "x", value: 1 },
      { ns: "ns", key: "y", value: 2 },
    ]);

    expect(writes().filter((call) => call.startsWith("writeFile"))).toHaveLength(1);
    expect(fakeFs.files.get(JSON_PATH)).toBe(text({ x: 1, y: 2 }));
  });

  it("birden çok namespace'i hiçbir şey yazmadan reddeder", async () => {
    const storage = reopen();
    await expect(
      storage.setMany([
        { ns: "a", key: "x", value: 1 },
        { ns: "b", key: "y", value: 2 },
      ]),
    ).rejects.toThrow("tek namespace");

    expect(fakeFs.files.size).toBe(0);
  });
});

describe("clear", () => {
  it("clear(ns) önce .tmp'yi, sonra .json'u, sonra okunamayan kopyaları siler; başka ns'e dokunmaz", async () => {
    fakeFs.files.set(JSON_PATH, text({ k: 1 }));
    fakeFs.files.set(TMP_PATH, text({ k: 2 }));
    fakeFs.files.set(UNREADABLE, "{bozuk");
    fakeFs.files.set(`${DIR}/baska.json`, text({ k: 3 }));

    await reopen().clear("ns");

    expect(writes()).toEqual([`deleteFile ${TMP_PATH}`, `deleteFile ${JSON_PATH}`, `deleteFile ${UNREADABLE}`]);
    expect([...fakeFs.files.keys()]).toEqual([`${DIR}/baska.json`]);
  });
});

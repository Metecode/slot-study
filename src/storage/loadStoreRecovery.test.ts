import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyStore, SCHEMA_VERSION } from "../domain/progress";
import type { QuestionProgress } from "../domain/progress";
import { fakeFs } from "../platform/storage/fakeFilesystem";
import { createFilesystemAdapter } from "../platform/storage/filesystemAdapter";
import { TEST_ADAPTERS } from "../platform/storage/testAdapters";
import type { StorageAdapter } from "../platform";
import { MAX_CORRUPT_BACKUPS } from "./corruptBackup";
import { loadStore } from "./db";
import { CORRUPT_BACKUP_PREFIX, STORE_KEY, STORE_NS } from "./storeKeys";

/* ------------------------------------------------------------------ */
/* Açılışta okuma: tekrar deneme, bozuk kaydın yedeği ve kurtarma      */
/* ------------------------------------------------------------------ */

vi.mock("@capacitor/filesystem", () => import("../platform/storage/fakeFilesystem"));

const NOW = new Date("2026-05-01T12:00:00.000Z");
const at = () => NOW;
const BACKUP_KEY = `${CORRUPT_BACKUP_PREFIX}${NOW.toISOString()}`;

const valid = (questionId: string): QuestionProgress => ({
  questionId,
  box: 3,
  lastSeenAt: "2026-04-01T10:00:00.000Z",
  attempts: [],
});

/** Bir geçerli, bir bozuk ilerleme kaydı taşıyan ham kayıt. */
function corruptRaw() {
  return {
    schemaVersion: SCHEMA_VERSION,
    progress: { q1: valid("q1"), q2: { questionId: "q2", box: "yüksek" } },
    settings: emptyStore().settings,
  };
}

/** set çağrılarının hangi anahtarlara, hangi sırayla gittiği. */
function setKeys(set: { mock: { calls: unknown[][] } }): unknown[] {
  return set.mock.calls.map((call) => call[1]);
}

beforeEach(() => {
  fakeFs.reset();
  // Hata ve kurtarma yolları bilerek loglanıyor; test çıktısını kirletmesin.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(TEST_ADAPTERS)("%s", (_name, create) => {
  describe("bozuk kayıt", () => {
    it("ham kaydı birebir yedekler, sonra kurtarılanı ana anahtara yazar", async () => {
      const storage = create();
      await storage.set(STORE_NS, STORE_KEY, corruptRaw());
      const set = vi.spyOn(storage, "set");

      const result = await loadStore(storage, at);

      expect(result.status).toBe("recovered");
      expect(result.store.progress).toEqual({ q1: valid("q1") });
      expect(await storage.get(STORE_NS, BACKUP_KEY)).toEqual(corruptRaw());
      // Yedek yazılmadan ana anahtara dokunulmaz.
      expect(setKeys(set)).toEqual([BACKUP_KEY, STORE_KEY]);
      expect(await storage.get(STORE_NS, STORE_KEY)).toEqual(result.store);
    });

    it("kayıp türünü bildirir", async () => {
      const storage = create();
      await storage.set(STORE_NS, STORE_KEY, corruptRaw());

      const result = await loadStore(storage, at);
      expect(result.status === "recovered" && result.loss).toBe("someProgress");
    });

    it("yedek yazılamazsa ana anahtara dokunmaz ve failed döner", async () => {
      const memory = create();
      await memory.set(STORE_NS, STORE_KEY, corruptRaw());
      const storage: StorageAdapter = {
        ...memory,
        set: (ns, key, value) =>
          key.startsWith(CORRUPT_BACKUP_PREFIX) ? Promise.reject(new Error("kota dolu")) : memory.set(ns, key, value),
      };
      const set = vi.spyOn(storage, "set");

      const result = await loadStore(storage, at);

      expect(result.status).toBe("failed");
      // Oturum bellekte kurtarılanla sürer, ama diskteki ham kayıt aynen durur.
      expect(result.store.progress).toEqual({ q1: valid("q1") });
      expect(setKeys(set)).toEqual([BACKUP_KEY]);
      expect(await memory.get(STORE_NS, STORE_KEY)).toEqual(corruptRaw());
    });

    it("ana anahtara yazma başarısızsa yalnızca loglar, yedek yerinde kalır", async () => {
      const memory = create();
      await memory.set(STORE_NS, STORE_KEY, corruptRaw());
      const storage: StorageAdapter = {
        ...memory,
        set: (ns, key, value) =>
          key === STORE_KEY ? Promise.reject(new Error("kota dolu")) : memory.set(ns, key, value),
      };

      const result = await loadStore(storage, at);

      expect(result.status).toBe("recovered");
      expect(await memory.get(STORE_NS, BACKUP_KEY)).toEqual(corruptRaw());
    });

    it(`en fazla ${MAX_CORRUPT_BACKUPS} yedek tutar, en eskisini siler`, async () => {
      const storage = create();
      const older = ["2026-04-01T00:00:00.000Z", "2026-04-02T00:00:00.000Z", "2026-04-03T00:00:00.000Z"];
      for (const iso of older) await storage.set(STORE_NS, `${CORRUPT_BACKUP_PREFIX}${iso}`, "eski yedek");
      await storage.set(STORE_NS, STORE_KEY, corruptRaw());

      await loadStore(storage, at);

      const backups = (await storage.getAll(STORE_NS))
        .map((entry) => entry.key)
        .filter((key) => key.startsWith(CORRUPT_BACKUP_PREFIX))
        .sort();
      expect(backups).toEqual([
        `${CORRUPT_BACKUP_PREFIX}${older[1]}`,
        `${CORRUPT_BACKUP_PREFIX}${older[2]}`,
        BACKUP_KEY,
      ]);
    });
  });

  describe("okuma hatası", () => {
    it("bir kez başarısız olup ikinci denemede başarılıysa veriyi okur", async () => {
      const memory = create();
      const stored = { ...emptyStore(), progress: { q1: valid("q1") } };
      await memory.set(STORE_NS, STORE_KEY, stored);
      let reads = 0;
      const storage: StorageAdapter = {
        ...memory,
        get<T>(ns: string, key: string) {
          reads += 1;
          if (reads === 1) return Promise.reject(new Error("bağlantı kapandı"));
          return memory.get<T>(ns, key);
        },
      };

      const result = await loadStore(storage, at);

      expect(reads).toBe(2);
      expect(result.status).toBe("ok");
      expect(result.store).toEqual(stored);
    });

    it("kalıcı olarak başarısızsa failed döner ve depoya yazmaz", async () => {
      const memory = create();
      const storage: StorageAdapter = {
        ...memory,
        get: () => Promise.reject(new Error("IndexedDB kapalı")),
      };
      const set = vi.spyOn(storage, "set");
      const setMany = vi.spyOn(storage, "setMany");

      const result = await loadStore(storage, at);

      expect(result.status).toBe("failed");
      expect(set).not.toHaveBeenCalled();
      expect(setMany).not.toHaveBeenCalled();
    });
  });
});

/*
  Dosya deposunda bozulma kaydın içinde değil dosyanın kendisinde de
  olabilir (ör. güç kaybında yarım kalmış yazma). Adapter ham metni
  döner; loadStore onu diğer bozuk kayıtlar gibi yedekleyip kurtarır.
*/
describe("filesystemAdapter: okunamayan dosya", () => {
  it("ham metni yedekler, recovered döner; dosyanın kendisi de kenarda kalır", async () => {
    const dir = "Application Support/com.meteucar.slot";
    fakeFs.files.set(`${dir}/${STORE_NS}.json`, '{"schemaVersion":1,"progress":{"q1"');
    const storage = createFilesystemAdapter(at);

    const result = await loadStore(storage, at);

    expect(result.status).toBe("recovered");
    expect(await storage.get(STORE_NS, BACKUP_KEY)).toBe('{"schemaVersion":1,"progress":{"q1"');
    expect(await storage.get(STORE_NS, STORE_KEY)).toEqual(result.store);
    expect(fakeFs.files.get(`${dir}/${STORE_NS}.json.unreadable-2026-05-01T12-00-00.000Z`)).toBe(
      '{"schemaVersion":1,"progress":{"q1"',
    );
  });
});

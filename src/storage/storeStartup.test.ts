import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyStore, SCHEMA_VERSION } from "../domain/progress";
import type { Store } from "../domain/progress";
import { fakeFs } from "../platform/storage/fakeFilesystem";
import { TEST_ADAPTERS } from "../platform/storage/testAdapters";
import type { StorageAdapter } from "../platform";
import { STORE_KEY, STORE_NS } from "./storeKeys";
import { createStoreStartup } from "./storeStartup";

/* ------------------------------------------------------------------ */
/* Açılış fabrikası — tek okuma ve duruma göre yazıcı                  */
/* ------------------------------------------------------------------ */

/** Açılış değerinden farklı bir store; yazıcı bunu "değişiklik" görür. */
function changed(store: Store): Store {
  return { ...store, settings: { ...store.settings, fastMode: !store.settings.fastMode } };
}

vi.mock("@capacitor/filesystem", () => import("../platform/storage/fakeFilesystem"));

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
  describe("createStoreStartup", () => {
    it("iki kez çağrılınca depoyu bir kez okur, aynı sonucu verir", async () => {
      const storage = create();
      const get = vi.spyOn(storage, "get");
      const start = createStoreStartup(storage);

      const [first, second] = await Promise.all([start(), start()]);
      const third = await start();

      expect(get).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
      expect(third).toBe(first);
    });

    it("failed iken yazıcı kapalı: değişiklikten sonra da set ve setMany çağrılmaz", async () => {
      const storage: StorageAdapter = {
        ...create(),
        get: () => Promise.reject(new Error("IndexedDB kapalı")),
      };
      const set = vi.spyOn(storage, "set");
      const setMany = vi.spyOn(storage, "setMany");

      const { result, writer } = await createStoreStartup(storage)();
      expect(result.status).toBe("failed");

      await writer.write(result.store);
      await writer.write(changed(result.store));

      expect(set).not.toHaveBeenCalled();
      expect(setMany).not.toHaveBeenCalled();
    });

    it("ok iken yazıcı açık", async () => {
      const storage = create();
      await storage.set(STORE_NS, STORE_KEY, emptyStore());
      const set = vi.spyOn(storage, "set");

      const { result, writer } = await createStoreStartup(storage)();
      expect(result.status).toBe("ok");

      await writer.write(result.store);
      await writer.write(changed(result.store));

      expect(set).toHaveBeenCalledTimes(1);
      expect(await storage.get(STORE_NS, STORE_KEY)).toEqual(changed(result.store));
    });

    it("recovered iken yazıcı açık", async () => {
      const storage = create();
      await storage.set(STORE_NS, STORE_KEY, { schemaVersion: SCHEMA_VERSION, progress: "bozuk", settings: {} });

      const { result, writer } = await createStoreStartup(storage)();
      expect(result.status).toBe("recovered");

      // Açılıştaki yedek ve kurtarma yazmaları sayılmasın.
      const set = vi.spyOn(storage, "set");
      await writer.write(result.store);
      await writer.write(changed(result.store));

      expect(set).toHaveBeenCalledTimes(1);
      expect(await storage.get(STORE_NS, STORE_KEY)).toEqual(changed(result.store));
    });
  });
});

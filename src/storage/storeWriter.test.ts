import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyStore } from "../domain/progress";
import type { Store } from "../domain/progress";
import { initialSessionState, sessionReducer, toStore } from "../domain/session";
import { fakeFs } from "../platform/storage/fakeFilesystem";
import { TEST_ADAPTERS } from "../platform/storage/testAdapters";
import type { StorageAdapter } from "../platform";
import { loadStore } from "./db";
import { STORE_KEY, STORE_NS } from "./storeKeys";
import { createStoreWriter } from "./storeWriter";

/* ------------------------------------------------------------------ */
/* Yazıcı — açılışta yazmama ve yazmanın kapalı olduğu oturum          */
/* ------------------------------------------------------------------ */

/** App'in ilk render'da efekte verdiği değer: HYDRATE + toStore. */
function firstRenderValue(store: Store): Store {
  const state = sessionReducer(initialSessionState(), {
    type: "HYDRATE",
    progress: store.progress,
    settings: store.settings,
    contentCategories: [],
  });
  return toStore(state, store.settings);
}

vi.mock("@capacitor/filesystem", () => import("../platform/storage/fakeFilesystem"));

beforeEach(() => {
  fakeFs.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(TEST_ADAPTERS)("%s", (_name, create) => {
  describe("normal açılış", () => {
    it("kullanıcı bir şey değiştirmezse yazmaz, değiştirince bir kez yazar", async () => {
      const storage = create();
      await storage.set(STORE_NS, STORE_KEY, { ...emptyStore(), settings: { ...emptyStore().settings, initialized: true } });
      const set = vi.spyOn(storage, "set");

      const { store, status } = await loadStore(storage);
      expect(status).toBe("ok");
      const writer = createStoreWriter(storage, { enabled: true });

      // StrictMode: efekt açılışta iki kez, aynı değerle.
      await writer.write(firstRenderValue(store));
      await writer.write(firstRenderValue(store));
      expect(set).not.toHaveBeenCalled();

      const changed = firstRenderValue({ ...store, settings: { ...store.settings, fastMode: true } });
      await writer.write(changed);
      await writer.write(changed);
      expect(set).toHaveBeenCalledTimes(1);
      expect(await storage.get(STORE_NS, STORE_KEY)).toEqual(changed);
    });

    it("ilk kullanımda normalize edilmiş açılış değerini de yazmaz", async () => {
      const storage = create();
      const set = vi.spyOn(storage, "set");

      const { store, status } = await loadStore(storage);
      expect(status).toBe("empty");
      const writer = createStoreWriter(storage, { enabled: true });

      // HYDRATE ilk kullanımda initialized'ı ve kategorileri değiştiriyor;
      // yine de kullanıcı bir şey yapmadığı için diske gidilmez.
      await writer.write(firstRenderValue(store));
      expect(set).not.toHaveBeenCalled();
    });
  });

  describe("okuma kalıcı olarak başarısız", () => {
    it("oturum boyunca set ve setMany hiç çağrılmaz", async () => {
      const storage: StorageAdapter = {
        ...create(),
        get: () => Promise.reject(new Error("IndexedDB kapalı")),
      };
      const set = vi.spyOn(storage, "set");
      const setMany = vi.spyOn(storage, "setMany");

      const { store, status } = await loadStore(storage);
      expect(status).toBe("failed");
      const writer = createStoreWriter(storage, { enabled: status !== "failed" });

      await writer.write(firstRenderValue(store));
      await writer.write(firstRenderValue({ ...store, settings: { ...store.settings, fastMode: true } }));
      await writer.write(firstRenderValue({ ...store, settings: { ...store.settings, soundEnabled: false } }));

      expect(set).not.toHaveBeenCalled();
      expect(setMany).not.toHaveBeenCalled();
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyStore } from "../domain/progress";
import type { Store } from "../domain/progress";
import type { Category, Question } from "../domain/question";
import { initialSessionState, sessionReducer, toStore } from "../domain/session";
import type { SessionState } from "../domain/session";
import { fakeFs } from "../platform/storage/fakeFilesystem";
import { TEST_ADAPTERS } from "../platform/storage/testAdapters";
import type { StorageAdapter } from "../platform";
import { loadStore, saveStore } from "./db";
import { STORE_KEY, STORE_NS } from "./storeKeys";

/* ------------------------------------------------------------------ */
/* Depo — her adapter ile okuma/yazma (describe.each)                  */
/* ------------------------------------------------------------------ */

vi.mock("@capacitor/filesystem", () => import("../platform/storage/fakeFilesystem"));

const QUESTION: Question = {
  id: "q1",
  category: "sql",
  kind: "definition",
  topic: "Index",
  difficulty: 1,
  prompt: "q1 için soru metni",
  modelAnswer: "Yeterince uzun bir örnek cevap metni.",
  keyConcepts: [
    {
      id: "kavram-1",
      label: "Kavram 1",
      aliases: ["birinci"],
      anchors: ["Birinci kavramı anlatan yeterince uzun çapa cümlesi."],
    },
  ],
};

/** Diskten gelen store'la kurulan oturum; App.initState ile aynı yol. */
function hydrate(store: Store, contentCategories: readonly Category[] = []): SessionState {
  return sessionReducer(initialSessionState(), {
    type: "HYDRATE",
    progress: store.progress,
    settings: store.settings,
    contentCategories,
  });
}

/** Değerlendirilmiş bir turu kullanıcının puanıyla kapatır. */
function rate(state: SessionState, now: Date): SessionState {
  const evaluated: SessionState = {
    ...state,
    phase: "evaluated",
    current: QUESTION,
    evaluation: { source: "lexical", hits: ["kavram-1"], missing: [] },
  };
  return sessionReducer(evaluated, { type: "RATE", rating: 2, answer: "birinci", now });
}

function persisted(state: SessionState): Store {
  return toStore(state, {
    fastMode: false,
    soundEnabled: true,
    soundHintShown: false,
    hapticsEnabled: true,
    reminderEnabled: false,
    reminderOfferShown: false,
  });
}

beforeEach(() => {
  fakeFs.reset();
  // Hata yolları bilerek loglanıyor; test çıktısını kirletmesin.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(TEST_ADAPTERS)("%s", (_name, create) => {
  describe("Leitner ilerlemesi depoda kalıcı", () => {
    it("iki oturum boyunca kutu yükselir ve denemeler birikir", async () => {
      const storage = create();

      // İlk açılış: depo boş.
      const first = await loadStore(storage);
      expect(first.status).toBe("empty");
      const afterFirst = rate(hydrate(first.store), new Date("2026-04-01T10:00:00.000Z"));
      await saveStore(storage, persisted(afterFirst));

      // Sayfa yenilendi: yeni oturum diskten kurulur.
      const second = await loadStore(storage);
      expect(second.store.progress.q1.box).toBe(2);
      const afterSecond = rate(hydrate(second.store), new Date("2026-04-03T10:00:00.000Z"));
      await saveStore(storage, persisted(afterSecond));

      const third = await loadStore(storage);
      const progress = third.store.progress.q1;
      expect(progress.box).toBe(3);
      expect(progress.lastSeenAt).toBe("2026-04-03T10:00:00.000Z");
      expect(progress.attempts.map((attempt) => attempt.answer)).toEqual(["birinci", "birinci"]);
    });
  });

  describe("bilinen kategoriler depoda kalıcı", () => {
    it("eski kayıtta açılan yeni kategori kapatılınca sonraki açılışta kapalı kalır", async () => {
      const storage = create();
      // knownCategories'ten önceki sürümün kaydı: alan yok.
      await storage.set(STORE_NS, STORE_KEY, {
        ...emptyStore(),
        settings: { ...emptyStore().settings, activeCategories: ["sql"], initialized: true },
      });
      const content: Category[] = ["java", "sql", "react"];

      const first = hydrate((await loadStore(storage)).store, content);
      expect(first.activeCategories).toEqual(["sql", "java"]);

      // Alan şemada olmasaydı saveStore onu atar, Java her açılışta yeniden açılırdı.
      const closed = sessionReducer(first, { type: "TOGGLE_CATEGORY", category: "java" });
      await saveStore(storage, persisted(closed));

      const second = hydrate((await loadStore(storage)).store, content);
      expect(second.activeCategories).toEqual(["sql"]);
    });
  });

  describe("loadStore", () => {
    it("mevcut kullanıcı verisini sabit ns/key altından okur", async () => {
      const storage = create();
      const existing: Store = {
        ...emptyStore(),
        progress: {
          q1: { questionId: "q1", box: 4, lastSeenAt: "2026-03-01T00:00:00.000Z", attempts: [] },
        },
      };
      await storage.set("mulakat-slot", "store", existing);

      expect(STORE_NS).toBe("mulakat-slot");
      expect(STORE_KEY).toBe("store");
      const { store, status } = await loadStore(storage);
      expect(status).toBe("ok");
      expect(store.progress.q1.box).toBe(4);
    });

    it("geçerli kayıtta depoya yazmaz", async () => {
      const storage = create();
      await storage.set(STORE_NS, STORE_KEY, emptyStore());
      const set = vi.spyOn(storage, "set");

      await loadStore(storage);
      expect(set).not.toHaveBeenCalled();
    });

    it("depo okunamazsa fırlatmaz, boş store ve failed döner", async () => {
      const storage: StorageAdapter = {
        ...create(),
        get: () => Promise.reject(new Error("IndexedDB kapalı")),
      };

      const { store, status } = await loadStore(storage);
      expect(status).toBe("failed");
      expect(store).toEqual(emptyStore());
    });
  });

  describe("saveStore", () => {
    it("şemadan geçmeyen store'u yazmaz", async () => {
      const storage = create();
      const invalid = { ...emptyStore(), schemaVersion: 99 } as unknown as Store;

      await saveStore(storage, invalid);
      expect(await storage.get(STORE_NS, STORE_KEY)).toBeUndefined();
    });

    it("depo yazamazsa fırlatmaz", async () => {
      const storage: StorageAdapter = {
        ...create(),
        set: () => Promise.reject(new Error("kota dolu")),
      };

      await expect(saveStore(storage, emptyStore())).resolves.toBeUndefined();
    });
  });
});

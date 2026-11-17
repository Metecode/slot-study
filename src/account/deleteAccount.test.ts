import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryAdapter } from "../platform/storage/memoryAdapter";
import type { StorageAdapter } from "../platform";
import type { QuestionProgress } from "../domain/progress";
import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_INSTALL_KEY,
  ANALYTICS_NS,
  ANALYTICS_QUEUE_KEY,
  CORRUPT_BACKUP_PREFIX,
  STORE_KEY,
  STORE_NS,
} from "../storage/storeKeys";

/* ------------------------------------------------------------------ */
/* Hesap silme akışı — gerçek senkron ve oturum modülleri, sahte fetch */
/* ------------------------------------------------------------------ */

/*
  authClient ve progressSync taklit edilmiyor: akışın asıl iddiası bu iki
  modülün birlikte "silmeden sonra hiçbir istek gitmez" demesi. Sınır
  fetch. Modül durumu (token, askı bayrağı) modül değişkenlerinde yaşadığı
  için her testte kayıt defteri temizlenip modüller yeniden yükleniyor.
*/

const fetchMock = vi.fn<typeof fetch>();

type Modules = {
  auth: typeof import("../auth/authClient");
  sync: typeof import("../sync/progressSync");
  account: typeof import("./deleteAccount");
};

async function loadModules(): Promise<Modules> {
  vi.resetModules();
  return {
    auth: await import("../auth/authClient"),
    sync: await import("../sync/progressSync"),
    account: await import("./deleteAccount"),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function urlOf(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

/** Gönderilen isteklerin "METHOD url" listesi, sırasıyla. */
function sentRequests(): string[] {
  return fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? "GET"} ${urlOf(input)}`);
}

const PROGRESS: Record<string, QuestionProgress> = {
  a: { questionId: "a", box: 2, lastSeenAt: "2026-01-01T10:00:00Z", attempts: [] },
};

/** Oturumu açar: gerçek refresh akışı sahte bir yanıtla. */
async function signIn(auth: Modules["auth"]): Promise<void> {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      accessToken: "token-1",
      user: { id: "11111111-1111-4111-8111-111111111111", username: "metecode" },
    }),
  );
  await auth.refresh();
  fetchMock.mockClear();
}

async function seedLocal(storage: StorageAdapter): Promise<void> {
  await storage.set(STORE_NS, STORE_KEY, { progress: PROGRESS });
  await storage.set(STORE_NS, `${CORRUPT_BACKUP_PREFIX}2026-01-01T00:00:00.000Z`, "bozuk");
  // Başka bir namespace'e dokunulmamalı.
  await storage.set("baska-uygulama", "k", 1);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("deleteAccount", () => {
  it("uçuştaki PUT'u bekler, DELETE'ten sonra hiçbir PUT ya da POST gitmez", async () => {
    const { auth, sync, account } = await loadModules();
    await signIn(auth);

    // Silme başlamadan önce yola çıkmış bir PUT, elde tutuluyor.
    let respondPut!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        respondPut = resolve;
      }),
    );
    const push = sync.pushChanges(PROGRESS, ["a"]);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const deletion = account.deleteAccount({ clearLocal: false, storage: createMemoryAdapter(), reload: vi.fn() });

    // PUT bitmeden DELETE gitmemeli: mikro görev kuyruğu tamamen boşalsa da.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sentRequests()).toEqual(["PUT /api/progress"]);

    respondPut(jsonResponse({ applied: 1, merged: 0, ignored: 0 }));
    await push;
    await expect(deletion).resolves.toBe("deleted");

    // Silmeden sonra her tetik denenir: RATE/visibilitychange ve giriş.
    fetchMock.mockResolvedValue(jsonResponse([]));
    await sync.pushChanges(PROGRESS, ["a"]);
    await sync.syncAfterLogin(PROGRESS);

    expect(sentRequests()).toEqual(["PUT /api/progress", "DELETE /api/me"]);
  });

  it("kutu işaretliyken de silmeden sonra istek gitmez", async () => {
    const { auth, sync, account } = await loadModules();
    await signIn(auth);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await account.deleteAccount({ clearLocal: true, storage: createMemoryAdapter(), reload: vi.fn() });

    fetchMock.mockResolvedValue(jsonResponse([]));
    await sync.pushChanges(PROGRESS, ["a"]);
    await sync.syncAfterLogin(PROGRESS);

    expect(sentRequests()).toEqual(["DELETE /api/me"]);
  });

  it("sunucu silmezse senkron geri açılır, yerel veriye dokunulmaz", async () => {
    const { auth, sync, account } = await loadModules();
    await signIn(auth);
    const storage = createMemoryAdapter();
    await seedLocal(storage);
    const reload = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(account.deleteAccount({ clearLocal: true, storage, reload })).resolves.toBe("failed");

    expect(auth.getSnapshot().status).toBe("authenticated");
    expect(await storage.getAll(STORE_NS)).toHaveLength(2);
    expect(reload).not.toHaveBeenCalled();

    // Askı kalktı: bir sonraki RATE yine gider.
    fetchMock.mockResolvedValueOnce(jsonResponse({ applied: 1, merged: 0, ignored: 0 }));
    await sync.pushChanges(PROGRESS, ["a"]);
    expect(sentRequests()).toEqual(["DELETE /api/me", "PUT /api/progress"]);
  });

  it("kutu işaretliyken store'u ve yedekleri siler, sonra sayfayı yeniler", async () => {
    const { auth, account } = await loadModules();
    await signIn(auth);
    const storage = createMemoryAdapter();
    await seedLocal(storage);
    const reload = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(account.deleteAccount({ clearLocal: true, storage, reload })).resolves.toBe("deleted");

    expect(await storage.getAll(STORE_NS)).toEqual([]);
    expect(await storage.get("baska-uygulama", "k")).toBe(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("kutu işaretliyken ölçüm kimliği ve kuyruğu silinir, kapatma tercihi kalır", async () => {
    const { auth, account } = await loadModules();
    await signIn(auth);
    const storage = createMemoryAdapter();
    const consent = { enabled: false, noticeShown: true };
    await storage.set(ANALYTICS_NS, ANALYTICS_CONSENT_KEY, consent);
    await storage.set(ANALYTICS_NS, ANALYTICS_INSTALL_KEY, "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b");
    await storage.set(ANALYTICS_NS, ANALYTICS_QUEUE_KEY, []);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await account.deleteAccount({ clearLocal: true, storage, reload: vi.fn() });

    expect(await storage.getAll(ANALYTICS_NS)).toEqual([{ key: ANALYTICS_CONSENT_KEY, value: consent }]);
  });

  it("kutu işaretsizken ölçüm verisine dokunulmaz", async () => {
    const { auth, account } = await loadModules();
    await signIn(auth);
    const storage = createMemoryAdapter();
    await storage.set(ANALYTICS_NS, ANALYTICS_INSTALL_KEY, "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await account.deleteAccount({ clearLocal: false, storage, reload: vi.fn() });

    expect(await storage.get(ANALYTICS_NS, ANALYTICS_INSTALL_KEY)).toBeDefined();
  });

  it("yenileme, silme bitmeden çağrılmaz", async () => {
    const { auth, account } = await loadModules();
    await signIn(auth);
    const memory = createMemoryAdapter();
    const order: string[] = [];
    const storage: StorageAdapter = {
      ...memory,
      async clear(ns) {
        await Promise.resolve();
        await memory.clear(ns);
        order.push("clear");
      },
    };
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await account.deleteAccount({ clearLocal: true, storage, reload: () => order.push("reload") });

    expect(order).toEqual(["clear", "reload"]);
  });

  it("kutu işaretsizken yerel veri kalır, sayfa yenilenmez", async () => {
    const { auth, account } = await loadModules();
    await signIn(auth);
    const storage = createMemoryAdapter();
    await seedLocal(storage);
    const reload = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(account.deleteAccount({ clearLocal: false, storage, reload })).resolves.toBe("deleted");

    expect(await storage.getAll(STORE_NS)).toHaveLength(2);
    expect(reload).not.toHaveBeenCalled();
    expect(auth.getSnapshot().status).toBe("anonymous");
  });

  it("yerel silme başarısız olursa sayfa yenilenmez ve bu ayrıca bildirilir", async () => {
    const { auth, account } = await loadModules();
    await signIn(auth);
    const storage: StorageAdapter = {
      ...createMemoryAdapter(),
      clear: () => Promise.reject(new Error("IndexedDB kapalı")),
    };
    const reload = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(account.deleteAccount({ clearLocal: true, storage, reload })).resolves.toBe(
      "deletedLocalClearFailed",
    );

    expect(reload).not.toHaveBeenCalled();
    // Hesap yine de silindi: oturum anonim.
    expect(auth.getSnapshot().status).toBe("anonymous");
  });
});

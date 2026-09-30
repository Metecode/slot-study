import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Oturum istemcisi testleri — fetch taklit edilir                     */
/* ------------------------------------------------------------------ */

/*
  Modül durumu (access token, tek uçuş, bootstrap sözü) modül
  değişkenlerinde yaşıyor. Testler arasında sıfırlamak için modül her
  testte yeniden yükleniyor; test'e özel bir "reset" fonksiyonu
  eklemektense kayıt defterini temizlemek daha dürüst.
*/
type AuthModule = typeof import("./authClient");

const fetchMock = vi.fn<typeof fetch>();

async function loadClient(): Promise<AuthModule> {
  vi.resetModules();
  return import("./authClient");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Başarılı bir yenileme yanıtı. */
function refreshBody(accessToken = "token-1") {
  return {
    accessToken,
    user: { id: "11111111-1111-4111-8111-111111111111", username: "metecode" },
  };
}

/** Geciktirilebilir yanıt: eşzamanlılık testi isteği elde tutmak istiyor. */
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** İsteğin gittiği yolu, Request/URL/string ayrımına takılmadan verir. */
function urlOf(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

function authHeaderOf(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get("Authorization");
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // Ağ hataları bilerek loglanıyor; test çıktısını kirletmesin.
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("refresh", () => {
  it("eşzamanlı üç çağrıda tek istek atar", async () => {
    const auth = await loadClient();
    const pending = deferred();
    fetchMock.mockReturnValue(pending.promise);

    const calls = [auth.refresh(), auth.refresh(), auth.refresh()];
    pending.resolve(jsonResponse(refreshBody()));
    const results = await Promise.all(calls);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([true, true, true]);
    expect(auth.getSnapshot()).toEqual({
      status: "authenticated",
      user: refreshBody().user,
      reachable: true,
    });
  });

  it("uçuş bittikten sonra yeni çağrı yeni istek atar", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValue(jsonResponse(refreshBody()));

    await auth.refresh();
    await auth.refresh();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("açılışta ağ hatası olursa anonymous'a geçer, unknown'da kalmaz", async () => {
    const auth = await loadClient();
    fetchMock.mockRejectedValue(new TypeError("offline"));

    // Backend kapalıyken de giriş düğmesi görünmeli; unknown'da kalırsa
    // arayüz sonsuza kadar boş yer tutucu gösterir.
    await expect(auth.refresh()).resolves.toBe(false);
    // Cevap hiç gelmedi: giriş alanı bunu "şu an giremezsin" diye gösterir.
    expect(auth.getSnapshot()).toEqual({
      status: "anonymous",
      user: null,
      reachable: false,
    });
  });

  it("açılışta sunucu hatası olursa da anonymous'a geçer", async () => {
    const auth = await loadClient();
    // Vite proxy'si backend kapalıyken 500 döndürüyor; ağ hatasıyla aynı sonuç.
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(auth.refresh()).resolves.toBe(false);
    expect(auth.getSnapshot().status).toBe("anonymous");
  });

  it("açılışta yanıt şemaya uymazsa anonymous'a geçer", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValue(jsonResponse({ accessToken: "" }));

    await expect(auth.refresh()).resolves.toBe(false);
    expect(auth.getSnapshot().status).toBe("anonymous");
  });

  it("oturum açıkken gelen ağ hatası oturumu düşürmez", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValueOnce(jsonResponse(refreshBody()));
    await auth.refresh();

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(auth.refresh()).resolves.toBe(false);

    // Elde çalışan bir access token var; geçici bir hata için kullanıcıyı
    // çıkmış göstermenin karşılığı yok.
    expect(auth.getSnapshot()).toEqual({
      status: "authenticated",
      user: refreshBody().user,
      reachable: false,
    });
  });

  it("ulaşılamayan sunucu geri geldiğinde bayrak da geri döner", async () => {
    const auth = await loadClient();
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await auth.refresh();
    expect(auth.getSnapshot().reachable).toBe(false);

    fetchMock.mockResolvedValueOnce(jsonResponse(refreshBody()));
    await auth.refresh();

    expect(auth.getSnapshot().reachable).toBe(true);
  });

  it("401 de bir cevaptır: sunucu ulaşılabilir sayılır", async () => {
    const auth = await loadClient();
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await auth.refresh();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await auth.refresh();

    expect(auth.getSnapshot()).toEqual({
      status: "anonymous",
      user: null,
      reachable: true,
    });
  });
});

describe("apiFetch", () => {
  it("401 alınca yeniler ve isteği bir kez tekrarlar", async () => {
    const auth = await loadClient();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse(refreshBody("token-2")))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const response = await auth.apiFetch("/api/progress");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(urlOf(fetchMock.mock.calls[1][0])).toBe("/api/auth/refresh");
    // Tekrar denenen istek yeni token'ı taşır.
    expect(urlOf(fetchMock.mock.calls[2][0])).toBe("/api/progress");
    expect(authHeaderOf(fetchMock.mock.calls[2][1])).toBe("Bearer token-2");
  });

  it("tekrar da 401 ise anonymous'a geçer ve ikinci kez yenilemez", async () => {
    const auth = await loadClient();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse(refreshBody()))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    const response = await auth.apiFetch("/api/progress");

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const refreshCalls = fetchMock.mock.calls.filter(
      (call) => urlOf(call[0]) === "/api/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
    expect(auth.getSnapshot()).toEqual({
      status: "anonymous",
      user: null,
      reachable: true,
    });
  });

  it("yenileme de 401 ise ilk yanıtı olduğu gibi döner", async () => {
    const auth = await loadClient();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    const response = await auth.apiFetch("/api/progress");

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(auth.getSnapshot().status).toBe("anonymous");
  });

  it("çağıranın init nesnesine Authorization yazmaz", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValueOnce(jsonResponse(refreshBody()));
    await auth.refresh();

    const init: RequestInit = { method: "POST", headers: { "content-type": "application/json" } };
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await auth.apiFetch("/api/progress", init);

    expect(authHeaderOf(init)).toBeNull();
    expect(authHeaderOf(fetchMock.mock.calls[1][1])).toBe("Bearer token-1");
  });
});

describe("bootstrap", () => {
  it("yenileme 401 dönerse durum anonymous olur, hata fırlatılmaz", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(auth.bootstrap()).resolves.toBe(false);
    expect(auth.getSnapshot()).toEqual({
      status: "anonymous",
      user: null,
      reachable: true,
    });
  });

  it("backend kapalıysa da durum anonymous'a bağlanır", async () => {
    const auth = await loadClient();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(auth.bootstrap()).resolves.toBe(false);
    expect(auth.getSnapshot()).toEqual({
      status: "anonymous",
      user: null,
      reachable: false,
    });
  });

  it("iki kez çağrılsa da tek istek atar", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValue(jsonResponse(refreshBody()));

    await Promise.all([auth.bootstrap(), auth.bootstrap()]);
    await auth.bootstrap();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("logout", () => {
  it("istek başarısız olsa bile durumu temizler", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValueOnce(jsonResponse(refreshBody()));
    await auth.refresh();
    expect(auth.getSnapshot().status).toBe("authenticated");

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await auth.logout();

    expect(auth.getSnapshot()).toEqual({
      status: "anonymous",
      user: null,
      reachable: true,
    });

    // Token da silindi: sonraki istek Authorization taşımıyor.
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await auth.apiFetch("/api/progress");
    expect(authHeaderOf(fetchMock.mock.calls[2][1])).toBeNull();
  });
});

describe("subscribe", () => {
  it("durum değişince dinleyiciyi uyarır, abonelik iptal edilince susar", async () => {
    const auth = await loadClient();
    const listener = vi.fn();
    const unsubscribe = auth.subscribe(listener);

    fetchMock.mockResolvedValueOnce(jsonResponse(refreshBody()));
    await auth.refresh();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await auth.logout();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("deleteAccount", () => {
  it("204'te DELETE /api/me gönderir, oturumu anonime çeker ve true döner", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValueOnce(jsonResponse(refreshBody()));
    await auth.refresh();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(auth.deleteAccount()).resolves.toBe(true);

    const [input, init] = fetchMock.mock.calls[1];
    expect(urlOf(input)).toBe("/api/me");
    expect(init?.method).toBe("DELETE");
    expect(authHeaderOf(init)).toBe("Bearer token-1");
    expect(auth.getSnapshot()).toEqual({ status: "anonymous", user: null, reachable: true });
  });

  it("sunucu hatasında false döner, oturum açık kalır", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValueOnce(jsonResponse(refreshBody()));
    await auth.refresh();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(auth.deleteAccount()).resolves.toBe(false);

    expect(auth.getSnapshot().status).toBe("authenticated");
  });

  it("ağ hatasında fırlatmaz, false döner", async () => {
    const auth = await loadClient();
    fetchMock.mockResolvedValueOnce(jsonResponse(refreshBody()));
    await auth.refresh();

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(auth.deleteAccount()).resolves.toBe(false);

    expect(auth.getSnapshot().status).toBe("authenticated");
  });
});

describe("native platform (kimlik kapalı)", () => {
  async function loadNativeClient(): Promise<AuthModule> {
    vi.resetModules();
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true },
    }));
    return import("./authClient");
  }

  afterEach(() => {
    vi.doUnmock("@capacitor/core");
  });

  it("açılışta anonim başlar ve bootstrap hiç istek atmaz", async () => {
    const auth = await loadNativeClient();

    expect(auth.getSnapshot().status).toBe("anonymous");
    await expect(auth.bootstrap()).resolves.toBe(false);
    await expect(auth.refresh()).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("apiFetch, logout ve deleteAccount ağa çıkmaz", async () => {
    const auth = await loadNativeClient();

    await expect(auth.apiFetch("/api/progress")).rejects.toThrow();
    await auth.logout();
    await expect(auth.deleteAccount()).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

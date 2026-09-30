import { z } from "zod";

import { platformFeatures } from "../platform";

/* ------------------------------------------------------------------ */
/* Oturum istemcisi — React bilmez, saf modül                          */
/* ------------------------------------------------------------------ */

/*
  Access token yalnızca bu modülün içindeki bir değişkende yaşar:
  localStorage'a yazılmaz (bkz. CLAUDE.md "localStorage'a JWT yazma"),
  React state'ine de konmaz — render döngüsünün dışında kalsın,
  sekme kapanınca da kaybolsun. Kalıcı olan tek şey refresh cookie'si
  ve onu JavaScript hiç görmüyor (HttpOnly).
*/

const REFRESH_URL = "/api/auth/refresh";
const LOGOUT_URL = "/api/auth/logout";
const LOGIN_URL = "/oauth2/authorization/github";
const ACCOUNT_URL = "/api/me";

const authUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
});

/** Backend'in RefreshResponse kaydıyla birebir. */
const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: authUserSchema,
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * "unknown" yalnızca açılıştaki ilk yenileme sonuçlanana kadar sürer.
 * Arayüz bu durumda hiçbir şey göstermez: "Giriş yap" yazıp yarım saniye
 * sonra kullanıcı adına dönen bir titreme olmasın.
 */
export type AuthStatus = "unknown" | "anonymous" | "authenticated";

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  /**
   * Son denemede backend cevap verebildi mi? Uygulama backend'siz tam
   * çalıştığı için bu bir hata değil, bir durum: yalnızca giriş alanı
   * okur ve "şu an giremezsin" demek için kullanır. Sunucunun 401
   * demesi de bir cevaptır — ulaşılabilir sayılır.
   */
  reachable: boolean;
};

/*
  Native'de (mobil v1) kimlik tamamen kapalı: bu modül hiç istek atmaz.
  Arayüz giriş alanını zaten çizmiyor; buradaki kontroller, bir kod yolu
  gözden kaçsa bile ağa çıkılmamasının güvencesi. Durum baştan "anonymous":
  açılış yenilemesi olmayacağı için "unknown"da beklemenin anlamı yok.
*/
const authEnabled = platformFeatures.auth;

let accessToken: string | null = null;
let state: AuthState = { status: authEnabled ? "unknown" : "anonymous", user: null, reachable: true };

const listeners = new Set<() => void>();

/* ------------------------------------------------------------------ */
/* Abonelik — useSyncExternalStore ile okunur                          */
/* ------------------------------------------------------------------ */

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Aynı durum için hep aynı nesne döner; useSyncExternalStore kimliğe
 * bakarak yeniden render'a karar veriyor, her çağrıda yeni nesne
 * üretmek sonsuz döngü olurdu.
 */
export function getSnapshot(): AuthState {
  return state;
}

/**
 * Değişen alanları uygular. Hiçbir şey değişmediyse nesne kimliği de
 * değişmez: useSyncExternalStore kimliğe bakıyor, her çağrıda yeni nesne
 * üretmek sonsuz render döngüsü olurdu.
 */
function patch(next: Partial<AuthState>): void {
  const merged: AuthState = { ...state, ...next };
  if (
    merged.status === state.status &&
    merged.user === state.user &&
    merged.reachable === state.reachable
  ) {
    return;
  }
  state = merged;
  for (const listener of listeners) listener();
}

/** Sunucu cevap verdi ve oturum yok. Cevap geldiğine göre ulaşılabilir. */
function setAnonymous(): void {
  accessToken = null;
  patch({ status: "anonymous", user: null, reachable: true });
}

/**
 * Yenileme başarısız bitti ama sebebi 401 değil (ağ, 5xx, bozuk yanıt).
 *
 * Açılıştaki ilk yenileme buraya düşerse durum "unknown"da BIRAKILAMAZ:
 * arayüz o durumda boş yer tutucu gösteriyor, yani backend kapalıyken
 * giriş düğmesi hiç görünmezdi. Bilmiyoruz demekle giremiyoruz demek
 * arasında, kullanıcı açısından fark yok — anonim kabul edilir.
 *
 * Oturum zaten açıkken gelen geçici hata ise oturumu düşürmez: elde
 * çalışan bir access token var, kullanıcı çevrimiçi olunca devam eder.
 */
function settleUnknown(): void {
  patch({
    reachable: false,
    // Oturum zaten açıksa düşürülmez; yalnızca açılıştaki belirsizlik
    // anonime bağlanır.
    status: state.status === "unknown" ? "anonymous" : state.status,
  });
}

/* ------------------------------------------------------------------ */
/* Yenileme — tek uçuş                                                 */
/* ------------------------------------------------------------------ */

/*
  Aynı anda birden fazla yenileme isteği atmak sunucuda rotasyon yarışına
  dönüşüyor (bkz. CLAUDE.md "Eşzamanlı yenileme yarış durumu"): sunucu
  tarafında satır kilidi ve tolerans penceresi var ama doğru davranış
  istemcinin hiç yarıştırmaması. Devam eden bir istek varsa aynı Promise
  paylaşılır.
*/
let inFlight: Promise<boolean> | null = null;

/**
 * Cookie'deki refresh token'ı yeni bir access token'a çevirir.
 * Dönen değer "oturum açık mı" sorusunun cevabıdır; hata fırlatmaz.
 */
export function refresh(): Promise<boolean> {
  if (!authEnabled) return Promise.resolve(false);
  if (inFlight) return inFlight;

  inFlight = runRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runRefresh(): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(REFRESH_URL, { method: "POST", credentials: "same-origin" });
  } catch (error) {
    // Ağ hatası oturumun bittiği anlamına gelmez: çevrimdışı olabiliriz.
    // Açık bir oturum varsa dokunulmuyor, kullanıcı boş yere çıkmış
    // görünmesin; yalnızca açılıştaki belirsizlik anonime bağlanıyor.
    console.warn("Oturum yenilenemedi (ağ):", error);
    settleUnknown();
    return false;
  }

  if (response.status === 401) {
    setAnonymous();
    return false;
  }

  if (!response.ok) {
    // 5xx de geçici olabilir; ağ hatasıyla aynı kefede.
    // (Vite geliştirme proxy'si backend kapalıyken buraya 500 düşürüyor.)
    console.warn("Oturum yenilenemedi (sunucu):", response.status);
    settleUnknown();
    return false;
  }

  const parsed = refreshResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    console.warn("Yenileme yanıtı şemaya uymuyor:", parsed.error.issues);
    settleUnknown();
    return false;
  }

  accessToken = parsed.data.accessToken;
  patch({ status: "authenticated", user: parsed.data.user, reachable: true });
  return true;
}

/* ------------------------------------------------------------------ */
/* İstek — 401'de bir kez yenileyip bir kez tekrar dener               */
/* ------------------------------------------------------------------ */

/** Çağıranın init nesnesini bozmadan Authorization başlığını ekler. */
function withAuth(init: RequestInit): RequestInit {
  if (!accessToken) return init;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return { ...init, headers };
}

/**
 * Backend'e giden her istek buradan geçer.
 *
 * Süresi dolmuş bir token'la gelen istek herkese açık uçlarda bile 401
 * alıyor (bkz. CLAUDE.md), o yüzden yenileme her 401'de denenir.
 * Tekrar denenen istek de 401 dönerse yeniden yenilemeye KALKILMAZ:
 * token az önce tazelendiği için sorun token'ın süresi değil, yetki.
 * Aksi halde iki uç birbirini tetikleyip sonsuz döngü kurardı.
 *
 * Not: istek gövdesi tekrar için aynen kullanılıyor. Tek seferlik
 * okunabilen bir gövde (stream) verilirse tekrar başarısız olur;
 * uygulama içinde gövdeler düz metin/JSON.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  // Çağıranlar ağ hatasını zaten yakalıyor; kapalı kimlik onlar için
  // "istek gidemedi" ile aynı.
  if (!authEnabled) throw new Error("Kimlik doğrulama bu platformda kapalı");

  const first = await fetch(input, withAuth(init));
  if (first.status !== 401) return first;

  const refreshed = await refresh();
  // Yenileme tutmadıysa ilk yanıt neyse o dönülür; 401 ise refresh()
  // durumu zaten anonymous'a çekti.
  if (!refreshed) return first;

  const retry = await fetch(input, withAuth(init));
  if (retry.status === 401) setAnonymous();
  return retry;
}

/* ------------------------------------------------------------------ */
/* Giriş / çıkış                                                       */
/* ------------------------------------------------------------------ */

/**
 * OAuth akışı fetch ile yürümez: GitHub'a gidip geri dönen bir tarayıcı
 * yolculuğu, tam sayfa geçişi gerekiyor.
 */
export function login(): void {
  if (!authEnabled) return;
  window.location.assign(LOGIN_URL);
}

/**
 * Sunucudaki refresh token'ı iptal eder ve yerel durumu temizler.
 * İstek düşse bile yerel temizlik yapılır: kullanıcı "çıkış yap" dedi,
 * ekranda hâlâ girmiş görünmesi kabul edilemez.
 */
export async function logout(): Promise<void> {
  if (!authEnabled) {
    setAnonymous();
    return;
  }

  try {
    await fetch(LOGOUT_URL, { method: "POST", credentials: "same-origin" });
  } catch (error) {
    console.warn("Çıkış isteği gönderilemedi:", error);
  } finally {
    setAnonymous();
  }
}

/**
 * Hesabı sunucudan siler (DELETE /api/me). Sunucu refresh cookie'sini de
 * temizliyor; yalnızca 204'te yerel oturum anonime çekilir. Hata
 * fırlatmaz: başarısızlıkta oturum olduğu gibi kalır, false döner.
 */
export async function deleteAccount(): Promise<boolean> {
  try {
    const response = await apiFetch(ACCOUNT_URL, { method: "DELETE" });
    if (response.status !== 204) {
      console.warn("Hesap silinemedi:", response.status);
      return false;
    }
  } catch (error) {
    console.warn("Hesap silme isteği gönderilemedi:", error);
    return false;
  }

  setAnonymous();
  return true;
}

/* ------------------------------------------------------------------ */
/* Açılış                                                              */
/* ------------------------------------------------------------------ */

let bootstrapped: Promise<boolean> | null = null;

/**
 * Uygulama açılırken bir kez çağrılır: cookie varsa oturum sessizce
 * geri gelir, yoksa durum anonymous olur. İki kez çağrılsa da (StrictMode)
 * tek istek atılır — hem tek uçuş hem de burada tutulan söz sayesinde.
 */
export function bootstrap(): Promise<boolean> {
  bootstrapped ??= refresh();
  return bootstrapped;
}

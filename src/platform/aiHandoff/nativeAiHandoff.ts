import type { AiHandoffAdapter, ShareResult } from "./AiHandoffAdapter";
import { openExternal } from "./openExternal";

/* ------------------------------------------------------------------ */
/* Native (Capacitor) — pano ve paylaşım eklentileri                   */
/* ------------------------------------------------------------------ */

/*
  Pano için navigator.clipboard değil @capacitor/clipboard:
    - open uygulamayı arka plana atıyor; writeText odak kontrolünü sonraki
      bir görevde yapıp "Document is not focused" ile reddedebilir.
    - iOS'ta origin capacitor://localhost; WKWebView'in bu şemayı güvenli
      bağlam saydığı belgelenmemiş, saymazsa navigator.clipboard hiç yok.
  Eklenti ClipboardManager / UIPasteboard'a yazıyor: odak, kullanıcı
  hareketi ya da güvenli bağlam şartı yok.

  Eklentiler web bundle'ına ve precache'e girmez (bkz. vite.config.ts);
  adapter oluşturulurken yüklenmeye başlarlar. handoff.ts kopyayı başlatıp
  hemen open'ı çağırıyor; eklenti ilk kullanımda yükleniyor olsaydı
  Clipboard.write köprüye uygulama arka plana geçtikten sonra giderdi ve
  iOS arka planda JS'i kısa sürede askıya alıyor.

  Adapter hata yutar (bkz. AiHandoffAdapter.ts); yalnızca geliştirmede
  console'a yazılır.
*/

type ClipboardModule = typeof import("@capacitor/clipboard");
type ShareModule = typeof import("@capacitor/share");

/** İki platformda da eklentinin vazgeçme mesajı "Share canceled". */
const SHARE_CANCELLED = /cancel/i;

/** Yükleme başarısızsa önbelleğe alınmaz, bir sonraki çağrı yeniden dener. */
function cachedLoader<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    promise ??= load().catch((error: unknown) => {
      promise = null;
      throw error;
    });
    return promise;
  };
}

function report(error: unknown): void {
  if (import.meta.env.DEV) console.warn("[aiHandoff]", error);
}

export function createNativeAiHandoff(): AiHandoffAdapter {
  const loadClipboard = cachedLoader<ClipboardModule>(() => import("@capacitor/clipboard"));
  const loadShare = cachedLoader<ShareModule>(() => import("@capacitor/share"));

  // Önceden yükleme; hatası burada yutulur, ilk çağrı yeniden dener.
  loadClipboard().catch(report);
  loadShare().catch(report);

  return {
    async copy(text) {
      try {
        const { Clipboard } = await loadClipboard();
        await Clipboard.write({ string: text });
        return true;
      } catch (error) {
        report(error);
        return false;
      }
    },

    canShare: () => true,

    async share(text): Promise<ShareResult> {
      try {
        const { Share } = await loadShare();
        await Share.share({ text });
        return "shared";
      } catch (error) {
        if (error instanceof Error && SHARE_CANCELLED.test(error.message)) return "cancelled";
        report(error);
        return "failed";
      }
    },

    open: openExternal,
  };
}

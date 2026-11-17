import { createAnalyticsStorage } from "../analytics/analyticsStorage";
import { deleteAccount as deleteAccountOnServer } from "../auth/authClient";
import type { StorageAdapter } from "../platform";
import { STORE_NS } from "../storage/storeKeys";
import { resumeSync, suspendSync } from "../sync/progressSync";

/* ------------------------------------------------------------------ */
/* Hesap silme akışı — React bilmez                                    */
/* ------------------------------------------------------------------ */

/*
  Sıra önemli: önce senkron durdurulur ve uçuştaki istekler beklenir,
  sonra silme gönderilir. Aksi halde silme yanıtından hemen sonra
  sekme arka plana düştüğünde giden bir PUT, kullanıcının cevaplarını
  bir kez daha ağa taşırdı (sunucu 401 verse de).

  Depo ve sayfa yenileme dışarıdan gelir: testte bellek deposu ve sahte
  reload, uygulamada platform deposu ve location.reload.
*/

export type DeleteAccountOptions = {
  /** Bu cihazdaki ilerleme, ayarlar ve yedekler de silinsin mi? */
  clearLocal: boolean;
  storage: StorageAdapter;
  reload: () => void;
};

/**
 * failed: sunucu silmedi, senkron geri açıldı, hiçbir şey değişmedi.
 * deleted: hesap silindi; clearLocal verildiyse yerel veri de silindi ve
 * sayfa yenileniyor.
 * deletedLocalClearFailed: hesap silindi ama yerel veri silinemedi; sayfa
 * yenilenmez, kullanıcıya söylenmeli.
 */
export type DeleteAccountResult = "failed" | "deleted" | "deletedLocalClearFailed";

export async function deleteAccount({ clearLocal, storage, reload }: DeleteAccountOptions): Promise<DeleteAccountResult> {
  await suspendSync();

  const deleted = await deleteAccountOnServer();
  if (!deleted) {
    resumeSync();
    return "failed";
  }

  if (!clearLocal) {
    // Oturum artık anonim: askı kalksa da senkron istek atmaz. Kullanıcı
    // yeniden girerse yerel ilerleme yeni hesaba birleştirilir.
    resumeSync();
    return "deleted";
  }

  // Namespace'in tamamı: store kaydı ve bozuk kayıt yedekleri birlikte.
  // Kullanım ölçümünden yalnızca kurulum kimliği ve kuyruk: kapatma tercihi
  // veri değil, kalır; silinseydi kapatmış kullanıcı sessizce yeniden açılırdı.
  // Silme bitmeden yenilenirse yarım kalabilir; bu yüzden await.
  try {
    await storage.clear(STORE_NS);
    await createAnalyticsStorage(storage).clearCollected();
  } catch (error) {
    // Yenileme YAPILMAZ: yenilenseydi veri sessizce geri gelir, kullanıcı
    // silindiğini sanırdı. Askı da kalkmıyor; oturum anonim, fark etmez.
    console.error("Yerel veriler silinemedi:", error);
    return "deletedLocalClearFailed";
  }

  // Bellekteki oturum eski ilerlemeyi hâlâ tutuyor; yenileme onu boş
  // depodan yeniden kurar.
  reload();
  return "deleted";
}

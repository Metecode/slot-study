import { useEffect, useId, useRef, useState } from "react";

import styles from "./DeleteAccountDialog.module.css";
import { deleteAccount } from "../account/deleteAccount";
import { storage } from "../platform";

/* ------------------------------------------------------------------ */
/* Hesabı sil — onay diyaloğu                                          */
/* ------------------------------------------------------------------ */

/*
  Native <dialog> + showModal(): odak tuzağı, Escape ve arka planın
  etkisizleşmesi tarayıcıdan geliyor. İlk odak "Vazgeç"te — yanlışlıkla
  basılan Enter geri alınamaz bir işlemi başlatmasın.

  Diyalog AuthArea'da, oturum dallarının dışında çiziliyor: silme başarılı
  olunca durum anonime döner ve kullanıcı menüsü DOM'dan kalkar. Diyalog
  onun içinde olsaydı sonucu gösteremeden kaybolurdu.
*/

export type DeleteAccountDialogProps = {
  open: boolean;
  /**
   * Diyalog kapandı. deleted true ise hesap silinmişti; çağıran odağı
   * "Giriş yap"a taşır, çünkü diyaloğu açan menü artık yok.
   */
  onClose: (deleted: boolean) => void;
};

/**
 * confirm: onay bekleniyor (error doluysa son deneme başarısızdı).
 * pending: istek sürüyor; kutu işaretliyse sayfa yenilenene kadar burada kalır.
 * deleted / localClearFailed: sonuç, tek düğme "Kapat".
 */
type Phase = "confirm" | "pending" | "deleted" | "localClearFailed";

const GITHUB_APPS_URL = "https://github.com/settings/applications";
/** Politikanın "Hesabını silme" bölümü; id privacy/index.html'de. */
const POLICY_DELETION_URL = "/privacy#hesap-silme";

export function DeleteAccountDialog({ open, onClose }: DeleteAccountDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("confirm");
  const [clearLocal, setClearLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const checkboxId = useId();
  const hintId = useId();
  const resultId = useId();

  // Açılış: her seferinde temiz başlar, kutu işaretsiz.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setPhase("confirm");
      setClearLocal(false);
      setError(null);
      dialog.showModal();
      // showModal ilk odaklanabilir öğeyi seçer; açıkça Vazgeç'e alınıyor.
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Sonuç ekranında odak tek düğmeye, ekran okuyucu metni oradan okur.
  // Başarısız denemeden sonra da odak güvenli düğmeye döner: istek sürerken
  // düğmeler kilitliydi ve odak düşmüştü. Hata metni role="alert" ile okunur.
  useEffect(() => {
    if (phase === "deleted" || phase === "localClearFailed") closeRef.current?.focus();
    else if (phase === "confirm" && error) cancelRef.current?.focus();
  }, [phase, error]);

  const finished = phase === "deleted" || phase === "localClearFailed";

  async function handleDelete() {
    setPhase("pending");
    setError(null);

    const result = await deleteAccount({
      clearLocal,
      storage,
      reload: () => window.location.reload(),
    });

    if (result === "failed") {
      setPhase("confirm");
      setError("Hesap silinemedi. Bağlantını kontrol edip tekrar dene.");
      return;
    }
    if (result === "deletedLocalClearFailed") {
      setPhase("localClearFailed");
      return;
    }
    // Kutu işaretliyse sayfa yenileniyor; "pending"de kalmak doğru.
    if (!clearLocal) setPhase("deleted");
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-busy={phase === "pending"}
      // İstek sürerken Escape diyaloğu kapatmasın: sonuç kaybolur.
      onCancel={(event) => {
        if (phase === "pending") event.preventDefault();
      }}
      onClose={() => onClose(finished)}
    >
      <h2 id={titleId} className={styles.title}>
        Hesabı sil
      </h2>

      {finished ? (
        <>
          <p id={resultId} className={styles.result}>
            {phase === "deleted" ? "Hesabın silindi." : "Hesabın silindi ama bu cihazdaki veriler silinemedi."}
          </p>
          <div className={styles.actions}>
            {/* Odak buraya geliyor; sonuç metni düğmeyle birlikte okunsun. */}
            <button
              ref={closeRef}
              type="button"
              className={styles.secondary}
              aria-describedby={resultId}
              onClick={() => dialogRef.current?.close()}
            >
              Kapat
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.text}>
            Sunucudan kalıcı olarak silinir: GitHub kullanıcı adın ve kimliğin, senkronlanmış ilerlemen (yazdığın
            cevaplar dahil) ve tüm oturumların. Geri alınamaz.
          </p>

          <div className={styles.option}>
            <input
              id={checkboxId}
              type="checkbox"
              className={styles.checkbox}
              checked={clearLocal}
              disabled={phase === "pending"}
              aria-describedby={hintId}
              onChange={(event) => setClearLocal(event.target.checked)}
            />
            <label htmlFor={checkboxId} className={styles.label}>
              Bu cihazdaki verileri de sil (ilerleme ve ayarlar)
            </label>
          </div>
          <p id={hintId} className={styles.hint}>
            İşaretlemezsen ilerlemen ve ayarların bu cihazda kalır; tekrar giriş yaparsan ilerlemen yeni hesabına
            yüklenir.
          </p>

          <p className={styles.note}>
            GitHub&apos;daki uygulama iznini{" "}
            <a href={GITHUB_APPS_URL} target="_blank" rel="noreferrer" className={styles.link}>
              github.com/settings/applications
            </a>{" "}
            adresinden kaldırabilirsin.
          </p>

          {/* Yeni sekmede: aynı sekmede açılsaydı diyalog ve yarım kalan
              karar kaybolurdu. */}
          <p className={styles.note}>
            Ayrıntılar:{" "}
            <a href={POLICY_DELETION_URL} target="_blank" rel="noopener" className={styles.link}>
              Gizlilik politikası: Hesabını silme
            </a>
          </p>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button
              ref={cancelRef}
              type="button"
              className={styles.secondary}
              disabled={phase === "pending"}
              onClick={() => dialogRef.current?.close()}
            >
              Vazgeç
            </button>
            <button
              type="button"
              className={styles.danger}
              disabled={phase === "pending"}
              onClick={() => void handleDelete()}
            >
              Hesabı sil
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

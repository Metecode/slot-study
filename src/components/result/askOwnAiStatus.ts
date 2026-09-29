import type { ShareResult } from "../../platform";
import type { HandoffOutcome } from "../../platform/aiHandoff/handoff";

/* ------------------------------------------------------------------ */
/* "Kendi yapay zekâna sor" — eylem sonucundan durum mesajına           */
/* ------------------------------------------------------------------ */

/*
  Saf: hangi sonuçta ne söyleneceğine burası karar verir, AskOwnAi
  yalnızca gösterir. domain/'de değil, çünkü girdisi platform/'un tipleri.

  Başarılı açılışta mesaj yok: sonuç açılan sayfada görünüyor ve kullanıcı
  o sırada başka sekmede ya da uygulamada; döndüğünde göreceği onay
  bayatlamış olurdu. İstem adreste gittiyse kopyanın düşmesi de
  söylenmez, kopya yalnızca yedekti.
*/

export type AskOwnAiEvent =
  | { kind: "handoff"; outcome: HandoffOutcome }
  | { kind: "copy"; copied: boolean }
  | { kind: "share"; result: ShareResult };

export type AskOwnAiStatus = {
  /** Canlı bölgenin metni. */
  message: string;
  /** false: yalnızca ekran okuyucu duyurur. */
  visible: boolean;
  /** Prompt alanı kendiliğinden açılır: elle kopyalamanın yolu. */
  revealPrompt: boolean;
  /** "Promptu kopyala" düğmesi kısa süre "Kopyalandı" der. */
  confirmCopyButton: boolean;
  /** true: kısa süre sonra silinir. false: bir sonraki eyleme kadar kalır. */
  transient: boolean;
};

const COPY_FAILED: AskOwnAiStatus = {
  message: "Kopyalanamadı. Promptu aşağıdan elle kopyalayabilirsin.",
  visible: true,
  revealPrompt: true,
  confirmCopyButton: false,
  transient: false,
};

/** null: gösterilecek ya da duyurulacak bir şey yok. */
export function askOwnAiStatus(event: AskOwnAiEvent): AskOwnAiStatus | null {
  switch (event.kind) {
    case "handoff": {
      const { outcome } = event;
      if (outcome.promptIncluded) return null;
      if (!outcome.copied) return COPY_FAILED;
      // Kullanıcı açılan sayfadan döndüğünde de görsün: süreyle silinmez.
      return {
        message: "Prompt kopyalandı, açılan sayfaya yapıştırman yeterli.",
        visible: true,
        revealPrompt: false,
        confirmCopyButton: false,
        transient: false,
      };
    }

    case "copy":
      if (!event.copied) return COPY_FAILED;
      // Görsel onay düğmenin metninde; canlı bölge yalnızca okuyucu için.
      return {
        message: "Prompt panoya kopyalandı.",
        visible: false,
        revealPrompt: false,
        confirmCopyButton: true,
        transient: true,
      };

    case "share":
      // Vazgeçmek bir hata değil; paylaşılınca da söylenecek bir şey yok.
      if (event.result !== "failed") return null;
      return {
        message: "Paylaşılamadı. Promptu kopyalayıp yapıştırabilirsin.",
        visible: true,
        revealPrompt: false,
        confirmCopyButton: false,
        transient: false,
      };
  }
}

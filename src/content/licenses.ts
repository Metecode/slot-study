import codeLicense from "../../LICENSE?raw";
import contentLicense from "./LICENSE?raw";
import thirdPartyNotices from "./THIRD_PARTY_NOTICES?raw";

/* ------------------------------------------------------------------ */
/* Lisans metinleri — Lisanslar panelinin tek kaynağı                   */
/*                                                                     */
/* Dosyalar derlemede pakete gömülür (?raw); elle kopya yok, repodaki    */
/* metin değişince uygulamadaki de değişir. Web ve native aynı paketi    */
/* kullandığı için platform farkı yok.                                  */
/*                                                                     */
/* Kök LICENSE src/ dışında: Dockerfile.frontend onu ayrıca kopyalıyor.  */
/* ------------------------------------------------------------------ */

export const REPO_URL = "https://github.com/Metecode/slot-study";
export const CC_BY_SA_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

export type LicenseSection = {
  id: string;
  title: string;
  /** Metnin neyi kapsadığı, tek cümle. */
  scope: string;
  text: string;
};

export const LICENSE_SECTIONS: readonly LicenseSection[] = [
  {
    id: "kod",
    title: "Kaynak kod — MIT",
    scope: "Uygulamanın kaynak kodu.",
    text: codeLicense.trim(),
  },
  {
    id: "icerik",
    title: "Soru içeriği — CC BY-SA 4.0",
    scope: "Sorular, örnek cevaplar ve kavramlar.",
    text: contentLicense.trim(),
  },
  {
    id: "ucuncu-taraf",
    title: "Üçüncü taraf içerik",
    scope:
      "React kategorisindeki 44 soru sudheerj/reactjs-interview-questions'tan türetildi; o kısımlar için MIT bildirimi de geçerli.",
    text: thirdPartyNotices.trim(),
  },
];

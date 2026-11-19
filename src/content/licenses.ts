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
  /** Satırın adı: neyin lisansı. */
  name: string;
  /** Lisansın kısa adı; satırda adın yanında. */
  license: string;
  /** Satırın altında tek cümle; yoksa satır yalnızca ad ve lisans. */
  description?: string;
  /** Lisansın resmî sayfası; açılan bölümde metnin üstünde. */
  url?: string;
  text: string;
};

export const LICENSE_SECTIONS: readonly LicenseSection[] = [
  {
    id: "kod",
    name: "Kaynak kod",
    license: "MIT",
    text: codeLicense.trim(),
  },
  {
    id: "icerik",
    name: "Soru içeriği",
    license: "CC BY-SA 4.0",
    description: "Kaynak belirterek ve aynı lisansla paylaşabilirsin.",
    url: CC_BY_SA_URL,
    text: contentLicense.trim(),
  },
  {
    id: "ucuncu-taraf",
    name: "sudheerj/reactjs-interview-questions",
    license: "MIT",
    description: "44 soru bu kaynaktan uyarlandı.",
    text: thirdPartyNotices.trim(),
  },
];

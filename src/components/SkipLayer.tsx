import { createPortal } from "react-dom";

import styles from "./SkipLayer.module.css";

/* ------------------------------------------------------------------ */
/* Atlama katmanı — dönüş sürerken ekrana dokunmak animasyonu bitirir   */
/* ------------------------------------------------------------------ */

/*
  Neden ekranı kaplayan bir düğme:
  - iOS WebKit, etkileşimsiz öğelere yapılan dokunuşu document'a click
    olarak iletmiyor; belge düzeyinde bir dinleyici mobilde kaçırırdı.
    Gerçek bir <button> her platformda click alır.
  - Atlama dokunuşun sonunda (click) yapılır, başında (pointerdown) değil:
    başta yapılsaydı sonuç kartı hemen açılır ve aynı dokunuşun click'i
    karttaki bir düğmeye düşerdi. Click katmanda tüketilir; kart ondan
    sonra gelir, dokunuş başka bir şeyi (yeni çekiş, ayar, odak)
    tetiklemez.
  - Katman, altındaki her şeyin (ayarlar, üst çubuk) önünde: dönüş
    sürerken yapılan her dokunuş yalnızca atlama.

  Ekran okuyucudan gizli ve sekme sırasında yok: dönüş bir saniye kadar
  sürüyor, klavyenin atlama yolu Escape (Machine). Body'ye portal: kasada
  transform olursa position: fixed ona göre konumlanırdı.
*/

export type SkipLayerProps = {
  onSkip: () => void;
};

export function SkipLayer({ onSkip }: SkipLayerProps) {
  return createPortal(
    <button
      type="button"
      className={styles.layer}
      aria-hidden="true"
      tabIndex={-1}
      // Fareyle basınca düğme odak alıyor; katman kalkınca odak boşa düşmesin.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        onSkip();
      }}
    />,
    document.body,
  );
}

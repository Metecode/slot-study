import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";

import { paylineRowIndex, parseTranslateY } from "../audio/reelTicks";
import styles from "./Drum.module.css";
import { buildStrip, CENTER, stripTransform } from "./drumStrip";

/* ------------------------------------------------------------------ */
/* Tambur — dikey kayan şerit                                          */
/*                                                                     */
/* 3B prizma sürümü kaldırıldı: WebKit (iOS Safari ve iOS Chrome)      */
/* preserve-3d içeren pencereyi render etmiyor ve motoru güvenilir     */
/* biçimde ayırt etmenin yolu yok. İki kod yolu tutmak yerine tek yol: */
/* masaüstünde de aynı şerit çalışıyor, dolayısıyla masaüstünde test   */
/* edilen şey mobilde de aynı şey.                                     */
/*                                                                     */
/* Silindir hissi perspektiften değil, .window::after'daki üst-alt     */
/* karartma gradyanından geliyor.                                      */
/* ------------------------------------------------------------------ */

const OVERSHOOT_ROWS = 0.3;
const OVERSHOOT_AT = 0.9;
const EASE_SPIN = "cubic-bezier(.26,.84,.34,1)";
const EASE_SETTLE = "cubic-bezier(.2,.72,.3,1)";


export type DrumHandle = {
  /** Çalışan dönüşü sona atar; onSettle yine bir kez çağrılır. */
  finish(): void;
};

export type DrumProps = {
  /**
   * Havuzdaki etiketler. Şerit bunlardan doldurulur. Yeni bir dizi
   * (kimlik değişimi) şeridi dönmeden yeniden kurar: filtre değişince
   * tambur yeni düzeni hemen göstersin. Machine diziyi yalnızca yeni
   * dönüşte ya da boştayken yeniden üretir; dönüş sırasında değişmez.
   */
  labels: string[];
  /** Duracağı etiketin labels içindeki indeksi. */
  targetIndex: number;
  /** Her artışında yeni bir dönüş tetiklenir. */
  spinKey: number;
  durationMs: number;
  /** Hedefe varmadan kaç tur atılacağı. Tur = FACES satır (domain/reels.ts). */
  turns: number;
  /**
   * Havuzda tek değer varsa o değer; yoksa null.
   * Doluyken tambur dönmez: dönüş, hepsi aynı yazan üç satırın kayması
   * olurdu. Pencere tek satıra iner — komşu satırlar boş bırakılmaz,
   * hiç çizilmez; boş iki satır "dolmayı bekleyen yer" gibi okunuyordu.
   * Oturma bildirimi de hiç gelmez: turu açma işini Machine gerçekten
   * dönen tambura veriyor.
   *
   * Etiket `labels` ile aynı düzenden gelir (domain/reels.ts): iki
   * tamburdan biri canlı filtreden, öteki eski şeritten okursa ödeme
   * çizgisinde var olmayan bir kategori–konu çifti oluşuyordu.
   */
  frozenLabel?: string | null;
  onSettle?: () => void;
  /**
   * Dönüş sırasında ödeme çizgisindeki satır her değiştiğinde çağrılır
   * (ses tıkı için). Verilmezse şerit hiç izlenmez. Dönüş başında
   * okunur; dönüş ortasında verilmesi o dönüşü etkilemez.
   */
  onRowPass?: () => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Tek satır yüksekliğini piksel olarak okur. --row doğrudan okunamaz,
 * çözülmemiş metin döner. Yalnızca tık izleme kullanıyor; şeridin konumu
 * ölçüme bağlı değil (bkz. drumStrip.ts).
 */
function readRowHeight(el: HTMLElement): number {
  const h = Number.parseFloat(getComputedStyle(el).height);
  return Number.isFinite(h) && h > 0 ? h : 0;
}

export const Drum = forwardRef<DrumHandle, DrumProps>(function Drum(
  {
    labels,
    targetIndex,
    spinKey,
    durationMs,
    turns,
    frozenLabel = null,
    onSettle,
    onRowPass,
  },
  ref,
) {
  const frozen = frozenLabel !== null;
  const stripRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);

  /** Şu an ortada duran etiket. Sonraki dönüşün başlangıcı bu olur. */
  const restLabelRef = useRef<string>(labels[targetIndex] ?? "");
  const lastSpunKeyRef = useRef<number | null>(null);

  const latest = useRef({ targetIndex, durationMs, turns, onSettle, onRowPass });
  latest.current = { targetIndex, durationMs, turns, onSettle, onRowPass };

  /**
   * Şerit spinKey ya da labels değişince yeniden kurulur. Dönüş bittikten
   * sonra yerinde bırakılır — sıfırlamak, kazananın bir kare boyunca
   * kaybolmasına yol açardı. turns bilerek bağımlılık değil: dönüş
   * sürerken hızlı mod açılırsa şerit yeniden kurulup animasyon iptal
   * olur, tur hiç kapanmazdı.
   */
  const { items, winnerPos } = useMemo(
    () =>
      buildStrip(
        labels,
        latest.current.targetIndex,
        latest.current.turns,
        restLabelRef.current,
      ),
    // spinKey gövdede okunmuyor ama bilerek bağımlılık: aynı etiketlerle
    // gelen yeni dönüş de şeridi ekrandaki dinlenme etiketinden kurmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spinKey, labels],
  );

  useImperativeHandle(
    ref,
    () => ({
      finish() {
        animationRef.current?.finish();
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    // Donmuş tamburun şeridi hiç kurulmuyor; yalnızca dinlenme etiketi
    // güncel tutuluyor ki havuz büyüyüp dönüş geri geldiğinde ilk kare
    // ekrandaki yazıyı değiştirmesin.
    if (frozen) {
      // Kaydırma imperatif yazıldığı için React'in yönetiminde değil ve
      // aynı DOM düğümü yeniden kullanıldığında olduğu yerde kalıyor:
      // önceki dönüşten kalan öteleme temizlenmezse donmuş satır
      // pencerenin dışında duruyor.
      if (stripRef.current) stripRef.current.style.transform = "";
      restLabelRef.current = frozenLabel ?? "";
      lastSpunKeyRef.current = spinKey;
      return;
    }

    const strip = stripRef.current;
    const face = faceRef.current;
    if (!strip || !face) return;

    // Konum satır cinsinden; pikseli tarayıcı o anki satır yüksekliğiyle
    // çözer. Boyut değişince (döndürme, pencere) dönüş sırasında bile doğru.
    const total = items.length;
    const endRows = winnerPos - CENTER;
    const end = stripTransform(endRows, total);
    const isFirstMount = lastSpunKeyRef.current === null;
    const alreadySpun = lastSpunKeyRef.current === spinKey;
    lastSpunKeyRef.current = spinKey;

    // İlk bağlanışta dönüş yok: kazanan doğrudan ortada durur.
    // Aynı spinKey ile efekt tekrar çalışırsa (StrictMode, ya da boştayken
    // filtre değişip şerit yeniden kurulduysa) dönüş tekrarlanmaz.
    if (isFirstMount || alreadySpun) {
      strip.style.transform = end;
      restLabelRef.current = items[winnerPos] ?? "";
      return;
    }

    let settled = false;
    let watchFrame: number | null = null;
    const stopWatching = () => {
      if (watchFrame !== null) cancelAnimationFrame(watchFrame);
      watchFrame = null;
    };

    const settle = () => {
      if (settled) return;
      settled = true;
      stopWatching();
      restLabelRef.current = items[winnerPos] ?? "";
      latest.current.onSettle?.();
    };

    if (prefersReducedMotion()) {
      strip.style.transform = end;
      settle();
      return;
    }

    const animation = strip.animate(
      [
        { transform: stripTransform(0, total), easing: EASE_SPIN, offset: 0 },
        {
          transform: stripTransform(endRows + OVERSHOOT_ROWS, total),
          easing: EASE_SETTLE,
          offset: OVERSHOOT_AT,
        },
        { transform: end, offset: 1 },
      ],
      { duration: latest.current.durationMs, fill: "forwards" },
    );

    animationRef.current = animation;
    animation.onfinish = settle;

    /*
      Satır izleme: her karede şeridin o anki ötelemesi okunur, ödeme
      çizgisindeki satır değiştiyse bildirilir. Zamanlayıcı yerine konum:
      tık sıklığı dönüş hızını kendiliğinden izler, finish() ile atlanan
      dönüşte de kalan satırlar için tık yağmuru olmaz — izleme settle'da
      durur. getComputedStyle her karede stil hesaplatır; yalnızca
      dinleyen varken ve dönüş sürerken çalıştığı için kabul edilebilir.
    */
    if (latest.current.onRowPass) {
      let lastRow = CENTER;
      const watch = () => {
        // Satır yüksekliği her karede okunur: dönüş sırasında boyut
        // değişirse tık hesabı eski yükseklikle kalmasın.
        const y = parseTranslateY(getComputedStyle(strip).transform);
        const current = paylineRowIndex(y, readRowHeight(face), CENTER);
        if (current !== lastRow) {
          lastRow = current;
          latest.current.onRowPass?.();
        }
        watchFrame = requestAnimationFrame(watch);
      };
      watchFrame = requestAnimationFrame(watch);
    }

    return () => {
      stopWatching();
      animation.cancel();
      if (animationRef.current === animation) animationRef.current = null;
      // İptal edilse bile şerit hedefte kalsın, pencere boş görünmesin.
      strip.style.transform = end;
    };
  }, [spinKey, items, winnerPos, frozen, frozenLabel]);

  if (frozen) {
    return (
      <div className={styles.window} data-frozen="true" aria-hidden="true">
        <div ref={stripRef} className={styles.strip}>
          <div className={`${styles.face} ${styles.mid}`}>
            <span className={styles.label}>{frozenLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.window} aria-hidden="true">
      <div ref={stripRef} className={styles.strip}>
        {items.map((label, i) => (
          <div
            key={i}
            ref={i === 0 ? faceRef : undefined}
            className={
              i === winnerPos ? `${styles.face} ${styles.mid}` : styles.face
            }
          >
            <span className={styles.label}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

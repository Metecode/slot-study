import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";

import { paylineRowIndex, parseTranslateY } from "../audio/reelTicks";
import styles from "./Drum.module.css";
import { stripTransform } from "./drumStrip";

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

/** Machine'in kaç farklı etiket sağlayacağı. */
export const FACES = 16;

const OVERSHOOT_ROWS = 0.3;
const OVERSHOOT_AT = 0.9;
const EASE_SPIN = "cubic-bezier(.26,.84,.34,1)";
const EASE_SETTLE = "cubic-bezier(.2,.72,.3,1)";

/**
 * Şeritte ortaya gelen yüzün indeksi. Pencere üç satır gösterir;
 * 0 üstte, 1 ortada, 2 altta. Şerit hiç kaydırılmadığında ortada
 * duran yüz budur.
 */
const CENTER = 1;

export type DrumHandle = {
  /** Çalışan dönüşü sona atar; onSettle yine bir kez çağrılır. */
  finish(): void;
};

export type DrumProps = {
  /** Havuzdaki etiketler. Şerit bunlardan doldurulur. */
  labels: string[];
  /** Duracağı etiketin labels içindeki indeksi. */
  targetIndex: number;
  /** Her artışında yeni bir dönüş tetiklenir. */
  spinKey: number;
  durationMs: number;
  /** Hedefe varmadan kaç tur atılacağı. Tur = FACES satır. */
  turns: number;
  /**
   * Havuzda tek değer varsa o değer; yoksa null.
   * Doluyken tambur dönmez: dönüş, hepsi aynı yazan üç satırın kayması
   * olurdu. Pencere tek satıra iner — komşu satırlar boş bırakılmaz,
   * hiç çizilmez; boş iki satır "dolmayı bekleyen yer" gibi okunuyordu.
   * Oturma bildirimi de hiç gelmez: turu açma işini Machine gerçekten
   * dönen tambura veriyor.
   *
   * Etiket ayrı bir alan olarak geliyor, `labels` üzerinden değil:
   * `labels` dönüş başına bir kez üretiliyor ve turlar arasında bilerek
   * eskimiş kalıyor. Kategori seçimi değiştiğinde donmuş tambur o eski
   * diziden okusaydı boş ya da yanlış bir satır gösterirdi.
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
 * Pencerede aynı anda görünen üç satırdan ortadaki ile komşularının aynı
 * olmasını engeller. Havuzda başka bir değer yoksa dokunmaz.
 */
function separateNeighbors(
  items: string[],
  center: number,
  pool: readonly string[],
): void {
  const label = items[center];
  const other = pool.find((value) => value !== label);
  if (other === undefined) return;

  for (const index of [center - 1, center + 1]) {
    if (index >= 0 && index < items.length && items[index] === label) {
      items[index] = other;
    }
  }
}

/**
 * Şeridi kurar. Dinlenme etiketi CENTER'a konur ki dönüş başlarken
 * ekrandaki yazı değişmesin; kazanan, turların sonundaki konuma yazılır.
 *
 * Her iki konumun komşuları ayrıca ayrıştırılıyor. buildFaces yüz halkası
 * içinde tekrarı zaten engelliyor ama şerit halkayı sarmalıyor: kazananın
 * şeritteki komşuları faces[w±1] değil, faces[0] ve faces[2] oluyor.
 * İki değerli bir havuzda bu üçü zorunlu olarak aynı değere düşüyordu —
 * tambur durduğunda üç satır da aynı yazıyordu.
 */
function buildStrip(
  labels: string[],
  targetIndex: number,
  turns: number,
  restLabel: string,
): { items: string[]; winnerPos: number } {
  const pool = labels.length > 0 ? labels : [""];
  const winnerPos = CENTER + Math.max(1, turns) * FACES;
  const items: string[] = [];

  // Altta bir satır fazlası olsun, kayarken boşluk görünmesin.
  for (let i = 0; i <= winnerPos + 1; i++) {
    items.push(pool[i % pool.length] ?? "");
  }

  items[CENTER] = restLabel;
  items[winnerPos] = pool[targetIndex] ?? "";

  separateNeighbors(items, CENTER, pool);
  separateNeighbors(items, winnerPos, pool);

  return { items, winnerPos };
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

  const latest = useRef({ targetIndex, durationMs, turns, onSettle, onRowPass, labels });
  latest.current = { targetIndex, durationMs, turns, onSettle, onRowPass, labels };

  /**
   * Şerit yalnızca spinKey değişince yeniden kurulur. Dönüş bittikten
   * sonra yerinde bırakılır — sıfırlamak, kazananın bir kare boyunca
   * kaybolmasına yol açardı.
   */
  const { items, winnerPos } = useMemo(
    () =>
      buildStrip(
        latest.current.labels,
        latest.current.targetIndex,
        latest.current.turns,
        restLabelRef.current,
      ),
    [spinKey],
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
    // Aynı spinKey ile efekt tekrar çalışırsa (StrictMode) da dönüş tekrarlanmaz.
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

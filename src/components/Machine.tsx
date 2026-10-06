import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";

import { Drum, FACES } from "./Drum";
import type { DrumHandle } from "./Drum";
import { Lever } from "./Lever";
import { ARROW, SYMBOL_EDGE } from "./logoGeometry";
import { PaylineArrow } from "./PaylineArrow";
import { SoundHint } from "./SoundHint";
import { SoundToggle } from "./SoundToggle";
import { useMachineSound } from "../hooks/useMachineSound";
import { haptics } from "../platform/haptics";
import { CATEGORY_LABELS } from "../content/labels";
import type { Category, Question } from "../domain/question";
import styles from "./Machine.module.css";

/* ------------------------------------------------------------------ */
/* Makine — kasa, iki tambur ve kolu birleştirir.                      */
/* Reducer'a bağlanmaz: prop alır, olay yayar.                         */
/* ------------------------------------------------------------------ */

/** Kazanan yüzün indeksi. Ağırlıklı çekiliş domain/draw.ts'te yapılır;   */
/** burada yalnızca duruşta ortaya oturacak yüz sabittir.                */
const WINNING_INDEX = 6;

/**
 * Hiç kategori seçili değilken tamburda duran yer tutucu. Boş dize
 * bırakılınca yuva "yüklenmeyi bekliyor" gibi görünüyordu; çizgi,
 * gösterilecek bir şey olmadığını söylüyor. Kolun neden kapalı olduğunu
 * makinenin altındaki ipucu anlatıyor.
 */
const EMPTY_FACE = "—";

const NORMAL_TIMING = {
  first: { durationMs: 1300, turns: 3 },
  second: { durationMs: 1600, turns: 4 },
};

/**
 * Ödeme okunun boyu. Bant (üst ve alt kenarı çizili orta satır) logodaki
 * çerçeveye karşılık geliyor: ok satıra, logodaki ok çerçeveye ne oranla
 * duruyorsa öyle durur. Satır 64 px'te ~17×23 px, dar ekranda ~15×20 px.
 * Yuvaya konur: hem ok hem tamburun dış kenar boşluğu bunu okuyor.
 */
const PAYLINE_ARROW_VARS = {
  "--payline-arrow-h": `calc(var(--row) * ${ARROW.height / SYMBOL_EDGE})`,
  "--payline-arrow-w": `calc(var(--row) * ${ARROW.width / SYMBOL_EDGE})`,
} as CSSProperties;

const FAST_TIMING = {
  first: { durationMs: 300, turns: 1 },
  second: { durationMs: 400, turns: 1 },
};

export type MachineProps = {
  /** Çekilen soru; spinning'e girerken gelir. */
  question: Question | null;
  /** Tamburların etiket havuzunu türetmek için tüm içerik. */
  allQuestions: readonly Question[];
  /** Havuz yalnızca bu kategorilerdeki sorulardan kurulur. */
  activeCategories: Category[];
  /** Her artışında yeni bir dönüş tetiklenir. */
  spinKey: number;
  spinning: boolean;
  /** false ise kol devre dışı. */
  canSpin: boolean;
  fastMode: boolean;
  /** Makine sesi açık mı; varsayılan açık, tercih settings'te. */
  soundEnabled: boolean;
  /** Makinenin köşesindeki hoparlör düğmesi; ayarlar anahtarı ayrı yoldan gelir. */
  onSoundChange: (enabled: boolean) => void;
  /** iOS sessiz anahtar ipucu: 0 hiç, her artış ipucunu yeniden gösterir. */
  soundHintKey: number;
  onPull: () => void;
  onSettle: () => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Havuzdan rastgele bir değer seçer. Önce tam yasak listesi denenir;
 * havuz buna yetmiyorsa yalnızca bitişik komşular korunur, o da
 * yetmiyorsa ne varsa alınır. Kural üç kademede gevşediği için küçük
 * havuzlarda bile tek geçişte biter, sonsuz döngü olmaz.
 */
function pickFace(
  pool: readonly string[],
  banned: ReadonlySet<string>,
  adjacent: ReadonlySet<string>,
): string {
  const strict = pool.filter((value) => !banned.has(value));
  const loose = strict.length > 0 ? strict : pool.filter((value) => !adjacent.has(value));
  const source = loose.length > 0 ? loose : pool;
  return source[Math.floor(Math.random() * source.length)];
}

/**
 * FACES uzunluğunda etiket dizisi üretir. Kazanan yüz sabittir; diğer 15 yüz
 * havuzdan, art arda tekrarı ve kazanan komşuluğunu engelleyerek doldurulur.
 * Havuzda 3'ten az farklı değer varsa yasak listesi kendiliğinden boşa
 * düşer (pickFace tek geçişte çalışır, sonsuz döngü riski yoktur).
 */
function buildFaces(pool: readonly string[], winnerLabel: string): string[] {
  const effectivePool = pool.length > 0 ? pool : [winnerLabel];
  const faces = new Array<string>(FACES);
  faces[WINNING_INDEX] = winnerLabel;

  for (let step = 1; step < FACES; step++) {
    const idx = (WINNING_INDEX + step) % FACES;

    // İki komşuluk mesafesindeki dolu yüzlerin hiçbiri seçilemez: pencerede
    // aynı anda üç satır göründüğü için tekrar ancak böyle engellenir.
    // Doldurma kazananın etrafını dolandığından yalnızca geriye bakmak
    // yetmez — son yüzün komşusu zaten dolu olan ilk yüzdür.
    // Kazanan da bu komşulardan biri olduğu için hemen öncesi ve sonrası
    // kendiliğinden ondan farklı kalır.
    const banned = new Set<string>();
    const adjacent = new Set<string>();
    for (const offset of [-2, -1, 1, 2]) {
      const neighbor = faces[(idx + offset + FACES) % FACES];
      if (neighbor === undefined) continue;
      banned.add(neighbor);
      // Yan yana iki aynı etiket en göze batanı; havuz daralırsa en son bu verilir.
      if (offset === -1 || offset === 1) adjacent.add(neighbor);
    }

    faces[idx] = pickFace(effectivePool, banned, adjacent);
  }

  return faces;
}

export function Machine({
  question,
  allQuestions,
  activeCategories,
  spinKey,
  spinning,
  canSpin,
  fastMode,
  soundEnabled,
  onSoundChange,
  soundHintKey,
  onPull,
  onSettle,
}: MachineProps) {
  const sound = useMachineSound(soundEnabled);
  // Dinleyen yoksa Drum şeridi hiç izlemiyor; ses kapalıyken kare başı iş yok.
  const onRowPass = soundEnabled ? sound.tick : undefined;

  const leftDrumRef = useRef<DrumHandle>(null);
  const rightDrumRef = useRef<DrumHandle>(null);
  const leftSlotRef = useRef<HTMLDivElement>(null);
  const rightSlotRef = useRef<HTMLDivElement>(null);

  // Havuzlar içeriğe ve seçili kategorilere bağlı, dönüşe değil: spinKey
  // her arttığında yeniden hesaplanmaları gereksiz olurdu.
  const pool = useMemo(
    () => allQuestions.filter((q) => activeCategories.includes(q.category)),
    [allQuestions, activeCategories],
  );

  // Tek kategori seçiliyse leftPool tek değere iner; aynı şey tek soruluk
  // bir havuzda rightPool için olur. O tambur donduruluyor (aşağıya bkz.):
  // hepsi aynı yazan üç satırı kaydırmak dönüş gibi görünmüyor.
  const leftPool = useMemo(
    () =>
      Array.from(new Set(pool.map((q) => q.category))).map(
        (category) => CATEGORY_LABELS[category],
      ),
    [pool],
  );
  const rightPool = useMemo(() => Array.from(new Set(pool.map((q) => q.topic))), [pool]);

  // question null iken tamburlar son durumlarını korur; o an için bir
  // kazanan etiketi gerekmez ama dizi yine de FACES uzunluğunda olmalı,
  // bu yüzden havuzdan bir yedek seçilir.
  const winnerLeft = question ? CATEGORY_LABELS[question.category] : (leftPool[0] ?? "");
  const winnerRight = question ? question.topic : (rightPool[0] ?? "");

  // Yüzlerin rastgele dağılımı yalnızca dönüş başına bir kez üretilir;
  // bağımlılık bilerek yalnızca spinKey — havuz ve kazanan aynı dönüş
  // içinde zaten sabit kalır.
  const leftFaces = useMemo(
    () => buildFaces(leftPool, winnerLeft),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spinKey],
  );
  const rightFaces = useMemo(
    () => buildFaces(rightPool, winnerRight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spinKey],
  );

  // Havuzda tek değer varsa o tambur dönmez, o değeri sabit gösterir.
  // Etiket havuzdan okunuyor: yüz dizileri dönüş başına üretildiği için
  // kategori seçimi değişince eskimiş kalıyorlar.
  const frozenLeft = leftPool.length <= 1 ? (leftPool[0] ?? EMPTY_FACE) : null;
  const frozenRight = rightPool.length <= 1 ? (rightPool[0] ?? EMPTY_FACE) : null;
  const leftFrozen = frozenLeft !== null;
  const rightFrozen = frozenRight !== null;

  /*
    Turu, gerçekten dönen tamburların sonuncusu açar: sağ tambur ikinci
    durduğu için normalde o. Sağ donmuşsa sıra sola geçer; ikisi de
    donmuşsa ortada bekletecek bir animasyon yoktur, aşağıdaki efekt
    turu doğrudan açar.
  */
  const settleOwner = !rightFrozen ? "right" : !leftFrozen ? "left" : "none";

  // onSettle her render'da yeni bir kapanış, yani efekt tekrar tekrar
  // çalışabilir; hangi dönüşün açıldığı ayrıca tutuluyor ki tur başına
  // bir kez bildirilsin.
  const openedKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (settleOwner !== "none" || !spinning) return;
    if (openedKeyRef.current === spinKey) return;
    openedKeyRef.current = spinKey;
    onSettle();
  }, [spinKey, settleOwner, spinning, onSettle]);

  /*
    Animasyonu atlamanın klavye yolu. Fare için tamburlara tıklamak
    yetiyordu ama kol dönüş boyunca disabled olduğu için odak gövdeye
    düşüyor ve klavyedeki kullanıcının atlayacak bir hedefi kalmıyordu.
    Dinleyici yalnızca dönüş sürerken bağlanır.
  */
  useEffect(() => {
    if (!spinning) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      leftDrumRef.current?.finish();
      rightDrumRef.current?.finish();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [spinning]);

  const timing = fastMode ? FAST_TIMING : NORMAL_TIMING;

  // İki tambur da donmuşsa yuva tek satır yüksekliğinde kalır; ödeme
  // çizgisi sabit yerinden bu satıra çekilmeli.
  const bayRows = leftFrozen && rightFrozen ? "1" : "3";

  // Havuz boşken ödeme çizgisi hiçbir şeyi işaretlemiyor; accent bütçesi
  // de boşa gitmesin diye o durumda hiç görünmez.
  const paylineSettled = !spinning && pool.length > 0;

  /** Tamburun oturduğu anda pencereye küçük bir tık verir. */
  function bumpTick(el: HTMLDivElement | null) {
    if (!el || prefersReducedMotion()) return;
    el.classList.remove(styles.tick);
    // Sınıfı kaldırıp yeniden eklemek arada reflow gerektirir,
    // yoksa tarayıcı animasyonu yeniden başlamış saymaz.
    void el.offsetWidth;
    el.classList.add(styles.tick);
  }

  /** Dönerken tamburlara tıklanınca animasyon atlanır. */
  function handleBayClick() {
    if (!spinning) return;
    leftDrumRef.current?.finish();
    rightDrumRef.current?.finish();
  }

  return (
    <div className={styles.stage}>
      <div className={styles.machine}>
        <div className={styles.contact} aria-hidden="true" />

        <div className={styles.reelsColumn}>
          {/* Hangi tamburun ne gösterdiği belirsizdi; iki sütuna eşlenen etiket. */}
          <div className={styles.reelLabels} aria-hidden="true">
            <span className={styles.reelLabel}>KATEGORİ</span>
            <span className={styles.reelLabel}>KONU</span>
          </div>

          <div
            className={styles.bay}
            style={PAYLINE_ARROW_VARS}
            data-rows={bayRows}
            onClick={handleBayClick}
          >
            <div ref={leftSlotRef} className={`${styles.drumSlot} ${styles.drumSlotLeft}`}>
              <Drum
                ref={leftDrumRef}
                labels={leftFaces}
                targetIndex={WINNING_INDEX}
                spinKey={spinKey}
                durationMs={timing.first.durationMs}
                turns={timing.first.turns}
                frozenLabel={frozenLeft}
                onRowPass={onRowPass}
                onSettle={() => {
                  sound.stop();
                  haptics.reelStop();
                  bumpTick(leftSlotRef.current);
                  if (settleOwner === "left") onSettle();
                }}
              />
            </div>
            <div ref={rightSlotRef} className={`${styles.drumSlot} ${styles.drumSlotRight}`}>
              <Drum
                ref={rightDrumRef}
                labels={rightFaces}
                targetIndex={WINNING_INDEX}
                spinKey={spinKey}
                durationMs={timing.second.durationMs}
                turns={timing.second.turns}
                frozenLabel={frozenRight}
                onRowPass={onRowPass}
                onSettle={() => {
                  sound.stop();
                  haptics.reelStop();
                  bumpTick(rightSlotRef.current);
                  if (settleOwner === "right") onSettle();
                }}
              />
            </div>

            {/* Yalnızca duruşta görünür; oklar CSS geçişiyle dışarıdan içeri kayar. */}
            <div
              className={
                paylineSettled ? `${styles.payline} ${styles.paylineSettled}` : styles.payline
              }
              aria-hidden="true"
            >
              <span className={styles.paylineFill} />
              <PaylineArrow
                side="left"
                className={`${styles.paylineArrow} ${styles.paylineArrowLeft}`}
              />
              <PaylineArrow
                side="right"
                className={`${styles.paylineArrow} ${styles.paylineArrowRight}`}
              />
            </div>
          </div>
        </div>

        <div className={styles.leverColumn}>
          <div className={styles.soundToggle}>
            <SoundToggle enabled={soundEnabled} onChange={onSoundChange} />
            {/* Canlı bölge hep yerinde; ipucu ses kapanınca hemen kalkar. */}
            <div role="status">
              {soundEnabled && soundHintKey > 0 && <SoundHint key={soundHintKey} />}
            </div>
          </div>

          {/*
            Ses context'i ancak bir kullanıcı hareketinin içinde açılabiliyor.
            Lever onPull'u kol animasyonu bitince rAF içinden çağırıyor; o an
            artık hareket sayılmıyor. Kilit bu yüzden kola dokunulduğu anda
            (pointerup, keydown) sarmalayıcıda açılır, Lever'ın sözleşmesi aynı kalır.
            touchend ek güvence: eski iOS WebKit pointerup'ı her zaman kullanıcı
            hareketi saymıyor; iki kez çağrılması zararsız.
          */}
          <div
            className={styles.leverSlot}
            onPointerUpCapture={sound.unlock}
            onTouchEndCapture={sound.unlock}
            onKeyDownCapture={sound.unlock}
          >
            <Lever
              disabled={spinning || !canSpin}
              onPull={() => {
                // Ses ve titreşim aynı anda: kol çekişinin tek anı burası.
                sound.lever();
                haptics.leverPull();
                onPull();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

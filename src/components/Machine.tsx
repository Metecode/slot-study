import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { Drum } from "./Drum";
import type { DrumHandle } from "./Drum";
import { Lever } from "./Lever";
import { ARROW, SYMBOL_EDGE } from "./logoGeometry";
import { PaylineArrow } from "./PaylineArrow";
import { reelLabel } from "./reelLabel";
import { SkipLayer } from "./SkipLayer";
import { SoundHint } from "./SoundHint";
import { SoundToggle } from "./SoundToggle";
import { useSpinFeedback } from "../hooks/useSpinFeedback";
import { CATEGORY_LABELS } from "../content/labels";
import type { AnimationMode } from "../domain/progress";
import type { Category, Question } from "../domain/question";
import { buildReelLayout, pairOf, restingPair, WINNING_FACE } from "../domain/reels";
import { spinPlanFor } from "../domain/spinTiming";
import type { ReelColumn, ReelLayout } from "../domain/reels";
import styles from "./Machine.module.css";

/* ------------------------------------------------------------------ */
/* Makine — kasa, iki tambur ve kolu birleştirir.                      */
/* Reducer'a bağlanmaz: prop alır, olay yayar.                         */
/* ------------------------------------------------------------------ */

/**
 * Hiç kategori seçili değilken tamburda duran yer tutucu. Boş dize
 * bırakılınca yuva "yüklenmeyi bekliyor" gibi görünüyordu; çizgi,
 * gösterilecek bir şey olmadığını söylüyor. Kolun neden kapalı olduğunu
 * makinenin altındaki ipucu anlatıyor.
 */
const EMPTY_FACE = "—";

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
  /** Etkin animasyon modu (domain/spinTiming.ts). */
  animationMode: AnimationMode;
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

/** Donmuş tamburun şeridi kurulmuyor; dizi kimliği sabit kalsın diye tek örnek. */
const NO_FACES: string[] = [];

/** Seçim sırası düzeni etkilemez; yalnızca hangi kategorilerin açık olduğu. */
function filterKeyOf(categories: readonly Category[]): string {
  return [...categories].sort().join("|");
}

/** Tamburun alacağı etiketler: dönüyorsa yüzler, donmuşsa tek etiket. */
type DrumLabels = { faces: string[]; frozen: string | null };

function drumLabels<T>(column: ReelColumn<T>, toLabel: (value: T) => string): DrumLabels {
  if (column.kind === "frozen") {
    return {
      faces: NO_FACES,
      frozen: column.value === null ? EMPTY_FACE : toLabel(column.value),
    };
  }
  return { faces: column.faces.map(toLabel), frozen: null };
}

type BuiltLayout = {
  spinKey: number;
  filterKey: string;
  layout: ReelLayout;
  left: DrumLabels;
  right: DrumLabels;
};

function buildLayout(
  pool: readonly Question[],
  question: Question | null,
  previous: ReelLayout | null,
  spinKey: number,
  filterKey: string,
): BuiltLayout {
  // Soru varsa tambur onu gösterir; yoksa ekrandaki çift havuzda kaldıysa o.
  const pair = question ? pairOf(question) : restingPair(pool, previous?.pair ?? null);
  const layout = buildReelLayout(pool, pair, Math.random);
  return {
    spinKey,
    filterKey,
    layout,
    // Etiket metni tek yerden: "/" sonrasında satır kırılabilsin (reelLabel.ts).
    left: drumLabels(layout.category, (category) => reelLabel(CATEGORY_LABELS[category])),
    right: drumLabels(layout.topic, reelLabel),
  };
}

export function Machine({
  question,
  allQuestions,
  activeCategories,
  spinKey,
  spinning,
  canSpin,
  animationMode,
  soundEnabled,
  onSoundChange,
  soundHintKey,
  onPull,
  onSettle,
}: MachineProps) {
  const feedback = useSpinFeedback(soundEnabled);

  /*
    Süreler ve geri bildirimler moddan ve çekişin oturumdaki sırasından
    (domain/spinTiming.ts). spinKey oturumda kaç dönüş başladığını sayıyor:
    tamburlar şu anki dönüşü (spinKey), kol ise bir sonrakini (spinKey + 1)
    oynatır. Kısa modda oturumun ilk çekişi tam.
  */
  const plan = spinPlanFor(animationMode, spinKey);
  const leverPlan = spinPlanFor(animationMode, spinKey + 1);
  // Dinleyen yoksa Drum şeridi hiç izlemiyor; ses kapalıyken kare başı iş yok.
  const onRowPass = feedback.rowPass(plan);

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

  /*
    Tamburların her şeyi — yüzler, donmuş etiketler — tek düzenden gelir
    (domain/reels.ts). Düzen iki anda yeniden kurulur:
    - yeni dönüş (spinKey): kazanan çekilen soru;
    - dönmüyorken filtre değişimi: tambur filtre dışı bir şey göstermesin
      (cevap ekranındaki soru yine gösterilir, komşuları filtreden gelir);
    - tur kapandığında ekrandaki çift artık havuzda değilse.
    Dönüş sırasında hiç kurulmaz. SPIN ile spinKey ayrı render'larda
    geliyor (spinKey App'te efektle artıyor); arada kurulsaydı şerit
    kazanana animasyonsuz atlar, sonra kendinden kendine dönerdi.
    Önceki düzenin çiftine ihtiyaç olduğu için türetilmiş durum
    render sırasında güncelleniyor (React'in önerdiği kalıp).
  */
  const filterKey = filterKeyOf(activeCategories);
  const [built, setBuilt] = useState(() =>
    buildLayout(pool, question, null, spinKey, filterKey),
  );
  let current = built;
  const spinChanged = built.spinKey !== spinKey;
  const filterChanged = built.filterKey !== filterKey && !spinning;
  // Cevap ekranında filtre soruyu dışarıda bıraktıysa tur kapanınca
  // tambur o soruda kalmasın. Çift havuzdaysa dokunulmaz: yeniden
  // kurulsa komşu satırlar boşuna değişirdi.
  const pairLeftPool =
    !spinning &&
    question === null &&
    restingPair(pool, built.layout.pair) !== built.layout.pair;
  if (spinChanged || filterChanged || pairLeftPool) {
    current = buildLayout(pool, question, built.layout, spinKey, filterKey);
    setBuilt(current);
  }

  const leftFaces = current.left.faces;
  const rightFaces = current.right.faces;
  const frozenLeft = current.left.frozen;
  const frozenRight = current.right.frozen;
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

  /** Çalışan dönüşü sona atar; tamburlar yine birer kez oturur, sonuç aynı. */
  function finishSpin() {
    leftDrumRef.current?.finish();
    rightDrumRef.current?.finish();
  }

  /*
    Animasyonu atlamanın klavye yolu. Dokunma ve fare için ekranı kaplayan
    katman var (SkipLayer); kol dönüş boyunca disabled olduğu için odak
    gövdeye düşüyor ve klavyedeki kullanıcının atlayacak bir hedefi
    kalmıyordu. Dinleyici yalnızca dönüş sürerken bağlanır.
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

  return (
    <div className={styles.stage}>
      {/* Dönüş sürerken ekrana dokunmak atlar; Kapalı modda dönüş zaten anında. */}
      {spinning && plan.reelsAnimated && <SkipLayer onSkip={finishSpin} />}
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
          >
            <div ref={leftSlotRef} className={`${styles.drumSlot} ${styles.drumSlotLeft}`}>
              <Drum
                ref={leftDrumRef}
                labels={leftFaces}
                targetIndex={WINNING_FACE}
                spinKey={spinKey}
                durationMs={plan.left.durationMs}
                turns={plan.left.turns}
                frozenLabel={frozenLeft}
                onRowPass={onRowPass}
                onSettle={() => {
                  feedback.reelStopped(plan);
                  bumpTick(leftSlotRef.current);
                  if (settleOwner === "left") onSettle();
                }}
              />
            </div>
            <div ref={rightSlotRef} className={`${styles.drumSlot} ${styles.drumSlotRight}`}>
              <Drum
                ref={rightDrumRef}
                labels={rightFaces}
                targetIndex={WINNING_FACE}
                spinKey={spinKey}
                durationMs={plan.right.durationMs}
                turns={plan.right.turns}
                frozenLabel={frozenRight}
                onRowPass={onRowPass}
                onSettle={() => {
                  feedback.reelStopped(plan);
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
            onPointerUpCapture={feedback.unlock}
            onTouchEndCapture={feedback.unlock}
            onKeyDownCapture={feedback.unlock}
          >
            <Lever
              disabled={spinning || !canSpin}
              animated={leverPlan.leverAnimated}
              pullMs={leverPlan.leverPullMs}
              recoverMs={leverPlan.leverRecoverMs}
              onPull={() => {
                feedback.leverPulled(leverPlan);
                onPull();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import styles from "./Lever.module.css";

/* ------------------------------------------------------------------ */
/* Kol — ne yaptığını bilmez, yalnızca çekildiğini bildirir             */
/* ------------------------------------------------------------------ */

/** Kolun inebileceği en büyük açı. */
const MAX_ANGLE = 52;

/** Çekiliş sayılması için gereken açı: yolun %62'si. */
const THRESHOLD_ANGLE = MAX_ANGLE * 0.62;

/** Dikey sürükleme mesafesinin dereceye çevrim katsayısı. */
const DRAG_TO_ANGLE = 0.46;

/** Bu mesafenin altında kalan bırakma sürükleme değil, tıklamadır. */
const CLICK_TOLERANCE_PX = 6;

const PULL_MS = 165;
const RECOVER_MS = 430;

/** Pivot ve topuz merkezleri — SVG geometrisiyle birebir aynı olmalı. */
const PIVOT = { x: 40, y: 144 };
const KNOB = { x: 40, y: 28 };

export type LeverProps = {
  disabled?: boolean;
  onPull: () => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Kol aşağı çekilirken hızlanır. */
function easeInCubic(t: number): number {
  return t * t * t;
}

/** Kol yerine dönerken yavaşlar. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function Lever({ disabled = false, onPull }: LeverProps) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const armGRef = useRef<SVGGElement>(null);
  const knobGRef = useRef<SVGGElement>(null);

  /** Açı state değil: sürüklemenin her pikseli render tetiklememeli. */
  const angleRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startAngleRef = useRef(0);
  const movedRef = useRef(0);

  /** Otomatik çekme sürerken ikinci bir çekme başlamasın. */
  const autoPullingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function applyAngle(angle: number) {
    angleRef.current = angle;
    // Topuz kolla birlikte dönerse üstündeki ışık da döner; ters açı
    // vererek topuzu dünyaya göre sabit tutuyoruz.
    armGRef.current?.setAttribute("transform", `rotate(${angle} ${PIVOT.x} ${PIVOT.y})`);
    knobGRef.current?.setAttribute("transform", `rotate(${-angle} ${KNOB.x} ${KNOB.y})`);
    // Eşik durumu sınıfla verilir; inline stil yazmıyoruz.
    rootRef.current?.classList.toggle(styles.armed, angle >= THRESHOLD_ANGLE);
  }

  function stopAnimation() {
    if (frameRef.current === null) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }

  function animateAngle(
    to: number,
    durationMs: number,
    ease: (t: number) => number,
    onDone?: () => void,
  ) {
    stopAnimation();

    // Hareket kapalıysa ara kareler atlanır, sonuç aynı kalır.
    if (prefersReducedMotion()) {
      applyAngle(to);
      onDone?.();
      return;
    }

    const from = angleRef.current;
    const startedAt = performance.now();

    const step = (now: number) => {
      const t = clamp((now - startedAt) / durationMs, 0, 1);
      applyAngle(from + (to - from) * ease(t));

      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
        return;
      }
      frameRef.current = null;
      onDone?.();
    };

    frameRef.current = requestAnimationFrame(step);
  }

  /** Tıklama ve klavyenin ortak yolu: kol kendi iner, sonra toparlanır. */
  function autoPull() {
    if (disabled || autoPullingRef.current) return;

    if (prefersReducedMotion()) {
      // Kolu oynatmadan sonucu ver.
      onPull();
      return;
    }

    autoPullingRef.current = true;
    animateAngle(MAX_ANGLE, PULL_MS, easeInCubic, () => {
      onPull();
      animateAngle(0, RECOVER_MS, easeOutCubic, () => {
        autoPullingRef.current = false;
      });
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || event.button !== 0) return;

    // Otomatik çekmenin ortasında kol yakalanabilir; kontrolü kullanıcı alır.
    stopAnimation();
    autoPullingRef.current = false;

    draggingRef.current = true;
    startYRef.current = event.clientY;
    startAngleRef.current = angleRef.current;
    movedRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;

    const deltaY = event.clientY - startYRef.current;
    movedRef.current = Math.max(movedRef.current, Math.abs(deltaY));
    applyAngle(clamp(startAngleRef.current + deltaY * DRAG_TO_ANGLE, 0, MAX_ANGLE));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // Neredeyse hiç oynamadıysa niyet tıklamaktı.
    if (movedRef.current < CLICK_TOLERANCE_PX) {
      autoPull();
      return;
    }

    const reachedThreshold = angleRef.current >= THRESHOLD_ANGLE;
    if (reachedThreshold) {
      onPull();
    }
    animateAngle(0, RECOVER_MS, easeOutCubic);
  }

  function handlePointerCancel() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    // İptal edilen sürükleme çekiliş sayılmaz, kol sessizce toparlanır.
    animateAngle(0, RECOVER_MS, easeOutCubic);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled || event.repeat) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    // Varsayılan davranış engellenmezse buton ayrıca click üretir ve
    // kol iki kez çekilmiş olur.
    event.preventDefault();
    autoPull();
  }

  return (
    <button
      ref={rootRef}
      type="button"
      className={styles.root}
      aria-label="Kolu çek"
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      {/*
        Genişlik 150: kol MAX_ANGLE'da pivot etrafında sağa savrulur ve
        topuzun sağ kenarı x=149.2'ye ulaşır. Daha dar bir çerçeve
        topuzu kırpardı — çözüm açıyı kısmak değil, tuvali genişletmek.
      */}
      <svg className={styles.svg} viewBox="0 0 150 168" aria-hidden="true" focusable="false">
        <rect className={styles.plate} x={10} y={138} width={60} height={26} rx={3} />

        <g ref={armGRef} transform={`rotate(0 ${PIVOT.x} ${PIVOT.y})`}>
          {/* Işık kenarı önce çizilir, ana yüz üstünü kapatıp ince bir
              şerit bırakır. */}
          <path className={styles.armLight} d="M33 146 L37 146 L38 34 L36.5 34 Z" />
          <path className={styles.armBody} d="M35 146 L45 146 L42.5 34 L37.5 34 Z" />
          <path className={styles.armShadow} d="M45 146 L47 146 L43.5 34 L42.3 34 Z" />

          <rect className={styles.collar} x={31} y={118} width={18} height={8} rx={2} />
          <rect
            className={styles.collarHighlight}
            x={32}
            y={119.5}
            width={16}
            height={1.5}
            rx={0.75}
          />

          <g ref={knobGRef} transform={`rotate(0 ${KNOB.x} ${KNOB.y})`}>
            <circle className={styles.knob} cx={KNOB.x} cy={KNOB.y} r={17} />
            {/* Sağ yarıyı karartan örtü. */}
            <path className={styles.knobShade} d="M40 11 A17 17 0 0 1 40 45 Z" />
            <ellipse className={styles.knobGlint} cx={33} cy={21} rx={5.6} ry={3.8} />
            <circle className={styles.knobRim} cx={KNOB.x} cy={KNOB.y} r={17} />
          </g>
        </g>

        <circle className={styles.pivot} cx={PIVOT.x} cy={PIVOT.y} r={8.5} />
        <circle className={styles.pivotDot} cx={PIVOT.x} cy={PIVOT.y} r={2.8} />

        {/* Eşik göstergesi: kol buraya inince çekiliş sayılır. */}
        <rect className={styles.notch} x={62} y={104} width={8} height={2} />
      </svg>
    </button>
  );
}

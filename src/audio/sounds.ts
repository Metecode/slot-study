import { getRunningGraph } from "./audioContext";
import { shouldPlayTick } from "./reelTicks";

/* ------------------------------------------------------------------ */
/* Makine sesleri — sentez, dosya yok                                  */
/*                                                                     */
/* Mekanik alet sesi, kasino değil: melodi, zil, kazanma müziği yok.   */
/* Her ses kısa bir zarf: hızlı atak, üstel sönüm. Üstel rampa sıfıra  */
/* inemediği için hedef SILENCE; ardından kaynak durdurulur.           */
/* ------------------------------------------------------------------ */

const SILENCE = 0.0001;

type Graph = NonNullable<ReturnType<typeof getRunningGraph>>;

/** Tıkların ortak sınırı için son tık zamanı (ms). İki tambur paylaşır. */
let lastTickAt: number | null = null;

/** Tek bir sönümlü zarf: atak kadar sürede tepeye, sonra üstel iniş. */
function envelope(
  graph: Graph,
  start: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const gain = graph.context.createGain();
  gain.gain.setValueAtTime(SILENCE, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(SILENCE, start + attack + decay);
  gain.connect(graph.master);
  return gain;
}

/** Filtrelenmiş kısa gürültü patlaması: tık, mandal, temas sesi. */
function noiseBurst(
  graph: Graph,
  options: {
    start: number;
    filter: BiquadFilterType;
    frequency: number;
    q: number;
    peak: number;
    decay: number;
  },
): void {
  const { context, noise } = graph;
  const source = context.createBufferSource();
  source.buffer = noise;

  const filter = context.createBiquadFilter();
  filter.type = options.filter;
  filter.frequency.value = options.frequency;
  filter.Q.value = options.q;

  const gain = envelope(graph, options.start, options.peak, 0.001, options.decay);
  source.connect(filter).connect(gain);

  // Arabellek içinde rastgele bir yerden başla: art arda tıklar aynı
  // gürültü parçasını çalıp makineli tüfek gibi tekdüze duyulmasın.
  const offset = Math.random() * (noise.duration - options.decay - 0.01);
  source.start(options.start, Math.max(0, offset));
  source.stop(options.start + options.decay + 0.01);
}

/** Frekansı aşağı kayan kısa sinüs: darbenin gövdesi. */
function thump(
  graph: Graph,
  options: { start: number; from: number; to: number; peak: number; decay: number },
): void {
  const osc = graph.context.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(options.from, options.start);
  osc.frequency.exponentialRampToValueAtTime(options.to, options.start + options.decay);

  osc.connect(envelope(graph, options.start, options.peak, 0.003, options.decay));
  osc.start(options.start);
  osc.stop(options.start + options.decay + 0.02);
}

/**
 * Kol çekildi: mandalın kısa metalik çıtırtısı ve altında düşük bir
 * darbe. Toplam ~120ms. İkinci, daha zayıf çıtırtı mandalın yerine
 * oturmasıdır.
 *
 * scale süreleri çarpar (domain/spinTiming.ts soundScale): Kısa modda
 * ses kısalır, tınısı aynı kalır.
 */
export function playLever(scale = 1): void {
  const graph = getRunningGraph();
  if (!graph) return;
  const t = graph.context.currentTime;

  noiseBurst(graph, { start: t, filter: "bandpass", frequency: 2200, q: 1.2, peak: 0.9, decay: 0.04 * scale });
  noiseBurst(graph, { start: t + 0.045 * scale, filter: "bandpass", frequency: 3200, q: 1.5, peak: 0.45, decay: 0.03 * scale });
  thump(graph, { start: t, from: 150, to: 60, peak: 0.8, decay: 0.12 * scale });
}

/**
 * Bir yüz ödeme çizgisinden geçti: ~15ms, yüksek frekanslı tık.
 * Önceki tıka MIN_TICK_GAP_MS'den yakınsa atlanır.
 */
export function playTick(): void {
  const graph = getRunningGraph();
  if (!graph) return;

  const now = performance.now();
  if (!shouldPlayTick(now, lastTickAt)) return;
  lastTickAt = now;

  noiseBurst(graph, {
    start: graph.context.currentTime,
    filter: "bandpass",
    frequency: 4200,
    q: 2.5,
    peak: 0.5,
    decay: 0.015,
  });
}

/** Tambur durdu: tok bir darbe ve boğuk bir temas sesi. scale: bkz. playLever. */
export function playStop(scale = 1): void {
  const graph = getRunningGraph();
  if (!graph) return;
  const t = graph.context.currentTime;

  thump(graph, { start: t, from: 120, to: 50, peak: 1, decay: 0.16 * scale });
  noiseBurst(graph, { start: t, filter: "lowpass", frequency: 900, q: 0.7, peak: 0.6, decay: 0.035 * scale });
}

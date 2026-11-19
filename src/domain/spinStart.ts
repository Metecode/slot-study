import type { Phase } from "./session";

/* ------------------------------------------------------------------ */
/* Dönüşün başladığı an — spinKey ve spin ölçüm olayı buna bağlı         */
/*                                                                     */
/* Yalnızca spinning'e GİRİŞ sayılır: dönüş sürerken gelen render'lar,   */
/* reducer'ın reddettiği ikinci SPIN (art arda dokunuş) ve atlamada      */
/* hemen gelen SETTLE yeni bir dönüş değildir. Mod ve atlama faz         */
/* sırasını değiştirmez, yalnızca SETTLE'ın ne kadar erken geldiğini.    */
/* ------------------------------------------------------------------ */

export function spinStarted(previous: Phase, next: Phase): boolean {
  return next === "spinning" && previous !== "spinning";
}

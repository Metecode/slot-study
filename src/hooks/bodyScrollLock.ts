/* ------------------------------------------------------------------ */
/* Arka plan kaydırma kilidi — sayaçlı                                  */
/*                                                                     */
/* iOS'ta body'ye overflow: hidden yetmiyor: diyalog sona dayanınca ya  */
/* da parmak diyalog dışına değince kaydırma belgeye zincirleniyor.     */
/* body position: fixed ile sabitlenir, top eksi kaydırma konumu olur;  */
/* sayfa görünürde yerinde kalır. Kilit kalkınca konum geri yazılır.    */
/*                                                                     */
/* Sayaçlı: iki diyalog üst üste açılırsa kilit ancak sonuncusu         */
/* kapanınca kalkar. Konum yalnızca ilk kilitte okunur; ikinci kilit    */
/* anında body zaten sabit, window.scrollY 0 döner.                     */
/*                                                                     */
/* DOM'a doğrudan değil, verilen ortama dokunur: test ortamında DOM yok. */
/* ------------------------------------------------------------------ */

export type ScrollLockStyle = {
  position: string;
  top: string;
  width: string;
};

export type ScrollLockEnv = {
  style: ScrollLockStyle;
  getScrollY: () => number;
  scrollTo: (y: number) => void;
};

export type ScrollLock = {
  /** Kilidi alır; dönen fonksiyon yalnızca bir kez etkili olur. */
  acquire: () => () => void;
  /** Etkin kilit sayısı (test ve hata ayıklama için). */
  count: () => number;
};

export function createScrollLock(env: ScrollLockEnv): ScrollLock {
  let holders = 0;
  let savedY = 0;
  let savedStyle: ScrollLockStyle = { position: "", top: "", width: "" };

  function lock() {
    savedY = env.getScrollY();
    savedStyle = { position: env.style.position, top: env.style.top, width: env.style.width };
    env.style.position = "fixed";
    env.style.top = `-${savedY}px`;
    env.style.width = "100%";
  }

  function unlock() {
    env.style.position = savedStyle.position;
    env.style.top = savedStyle.top;
    env.style.width = savedStyle.width;
    env.scrollTo(savedY);
  }

  return {
    acquire() {
      if (holders === 0) lock();
      holders += 1;
      let released = false;
      return () => {
        // StrictMode ya da çift çağrı sayacı eksiye düşürmesin.
        if (released) return;
        released = true;
        holders -= 1;
        if (holders === 0) unlock();
      };
    },
    count: () => holders,
  };
}

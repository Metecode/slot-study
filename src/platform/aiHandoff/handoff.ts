import { buildHandoffUrl } from "../../domain/aiHandoff";
import type { HandoffFailure } from "../../domain/aiHandoff";
import type { AiTarget } from "../../domain/aiTargets";
import { aiHandoff } from "../index";
import type { AiHandoffAdapter } from "./AiHandoffAdapter";

/* ------------------------------------------------------------------ */
/* İstemi hedefe taşı — kopya ile açma sırasının tek yeri              */
/* ------------------------------------------------------------------ */

/*
  Kopya her durumda alınır, istem adreste gitse de: servis parametreyi
  düşürebilir ya da oturum yoksa girişe yönlendirip kaybedebilir.

  Sıra: kopya başlar (beklenmez), adres aynı tıklamada senkron açılır,
  sonra kopyanın sonucu beklenir. Önce beklenseydi tarayıcı açılır
  pencereyi kullanıcı hareketi dışında sayıp engelleyebilirdi. Bu yüzden
  handoff tıklama işleyicisinden, önünde await olmadan çağrılmalı.
*/

export type HandoffOutcome =
  | { promptIncluded: true; copied: boolean }
  | { promptIncluded: false; reason: HandoffFailure; copied: boolean };

export async function handoff(
  target: AiTarget,
  prompt: string,
  adapter: AiHandoffAdapter = aiHandoff,
): Promise<HandoffOutcome> {
  const { url, ...inclusion } = buildHandoffUrl(target, prompt);

  const copying = startCopy(adapter, prompt);
  adapter.open(url);

  return { ...inclusion, copied: await copying };
}

/** Sözleşmeye uymayan bir adapter'ın fırlatması ya da reddi de false sayılır. */
function startCopy(adapter: AiHandoffAdapter, text: string): Promise<boolean> {
  try {
    return adapter.copy(text).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

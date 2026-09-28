import type { AiHandoffAdapter, ShareResult } from "./AiHandoffAdapter";
import { openExternal } from "./openExternal";

/* ------------------------------------------------------------------ */
/* Web — Clipboard API, execCommand yedeği, Web Share                  */
/* ------------------------------------------------------------------ */

/*
  Kopyalama önce Clipboard API'yi dener; güvenli olmayan bağlamda (HTTP)
  yoksa ya da izin verilmezse eski yol: görünmez bir metin alanını seçip
  execCommand("copy").

  writeText reddedince execCommand yedeğine yalnızca belge hâlâ odaktaysa
  düşülür. handoff.ts kopyayı başlatıp hemen yeni sekme açıyor; ret
  "Document is not focused" yüzündense sekme zaten değişmiştir,
  execCommand ya çalışmaz ya da kopyalamadan true döner.
*/

/**
 * clipboard-first: writeText, ret gelirse (odak varsa) execCommand.
 * exec-command-first: önce senkron execCommand, false ise writeText.
 *
 * İkincisi handoff akışındaki yarışı ortadan kaldırır: execCommand yeni
 * sekme açılmadan, aynı karede biter. Bedeli kullanımdan kaldırılmış bir
 * API'ye öncelik vermek. Şimdilik clipboard-first; masaüstü Chrome'da yeni
 * sekme öne gelince writeText'in reddedildiği görülürse yalnızca bu sabit
 * değişir.
 */
export type CopyOrder = "clipboard-first" | "exec-command-first";
export const WEB_COPY_ORDER: CopyOrder = "clipboard-first";

/** Paylaşım sayfası yalnızca dokunmatik birincil işaretçide; masaüstü Chrome'da da navigator.share var. */
const TOUCH_PRIMARY_QUERY = "(hover: none) and (pointer: coarse)";

/** Görünmez bir metin alanını seçip kopyalar; senkron. */
function execCommandCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

/** writeText'i hemen başlatır; ret gelirse false. Clipboard API yoksa false. */
function clipboardWrite(text: string): Promise<boolean> {
  // Güvenli olmayan bağlamda (HTTP) navigator.clipboard hiç yok.
  if (!navigator.clipboard) return Promise.resolve(false);
  try {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

function copyClipboardFirst(text: string): Promise<boolean> {
  // Clipboard API yoksa execCommand beklemeden, açılacak sekmeden önce çalışır.
  if (!navigator.clipboard) return Promise.resolve(execCommandCopy(text));
  return clipboardWrite(text).then((ok) => ok || (document.hasFocus() && execCommandCopy(text)));
}

function copyExecCommandFirst(text: string): Promise<boolean> {
  if (execCommandCopy(text)) return Promise.resolve(true);
  return clipboardWrite(text);
}

async function share(text: string): Promise<ShareResult> {
  try {
    await navigator.share({ text });
    return "shared";
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "failed";
  }
}

export function createWebAiHandoff(copyOrder: CopyOrder): AiHandoffAdapter {
  return {
    copy: copyOrder === "clipboard-first" ? copyClipboardFirst : copyExecCommandFirst,
    canShare: () => typeof navigator.share === "function" && window.matchMedia(TOUCH_PRIMARY_QUERY).matches,
    share,
    open: openExternal,
  };
}

export const webAiHandoff: AiHandoffAdapter = createWebAiHandoff(WEB_COPY_ORDER);

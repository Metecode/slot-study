import { useEffect, useRef, useState } from "react";

import { copyToClipboard } from "../../platform";
import { CheckIcon, CopyIcon } from "./icons";
import styles from "./ModelAnswer.module.css";

/* ------------------------------------------------------------------ */
/* Kod bloğu — kopyalanabilir                                          */
/* ------------------------------------------------------------------ */

/** "kopyalandı" yazısının ekranda kaldığı süre. */
const COPIED_HOLD_MS = 1500;
/** Sönme süresi; tokens.css'teki --dur-base ile aynı tutuluyor. */
const COPIED_FADE_MS = 240;

/** Yorum satırı gövdeden ayrışsın diye: kabuk (#) ve C ailesi (//). */
function isComment(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("--");
}

export type CodeBlockProps = {
  lang: string | null;
  code: string;
};

export function CodeBlock({ lang, code }: CodeBlockProps) {
  // "idle" → tıkla → "shown" → 1.5s → "fading" → "idle"
  const [phase, setPhase] = useState<"idle" | "shown" | "fading">("idle");
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  function clearTimers() {
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current = [];
  }

  useEffect(() => clearTimers, []);

  async function handleCopy() {
    // Yazılamadıysa yanlış geri bildirim vermektense hiç vermemek doğru:
    // kullanıcı metni elle seçebilir.
    if (!(await copyToClipboard(code))) return;

    // Arka arkaya tıklamada eski sayaçlar yenisini erken söndürmesin.
    clearTimers();
    setPhase("shown");
    timersRef.current.push(
      setTimeout(() => setPhase("fading"), COPIED_HOLD_MS),
      setTimeout(() => setPhase("idle"), COPIED_HOLD_MS + COPIED_FADE_MS),
    );
  }

  const copied = phase !== "idle";

  return (
    <div className={styles.code}>
      <div className={styles.codeHead}>
        <span className={styles.codeLang}>{lang ?? "kod"}</span>
        <button
          type="button"
          className={styles.copyButton}
          data-faded={phase === "fading"}
          onClick={handleCopy}
        >
          {/* Simge tıkla birlikte değişir, yazı 1.5s sonra söner. */}
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className={styles.copyLabel}>{copied ? "kopyalandı" : "Kopyala"}</span>
        </button>
      </div>

      <pre className={styles.codeBody}>
        <code>
          {code.split("\n").map((line, index) => (
            <span key={index} className={isComment(line) ? styles.comment : undefined}>
              {line}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

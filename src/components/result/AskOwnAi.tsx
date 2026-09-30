import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";

import { AI_TARGETS } from "../../domain/aiTargets";
import type { AiTarget } from "../../domain/aiTargets";
import { buildOwnAiPrompt } from "../../domain/ownAiPrompt";
import type { Question } from "../../domain/question";
import { aiHandoff } from "../../platform";
import { handoff } from "../../platform/aiHandoff/handoff";
import { ChevronIcon } from "../ChevronIcon";
import { Collapse } from "../Collapse";
import styles from "./AskOwnAi.module.css";
import type { AskOwnAiEvent, AskOwnAiStatus } from "./askOwnAiStatus";
import { askOwnAiStatus } from "./askOwnAiStatus";
import { ExternalLinkIcon } from "./icons";

/* ------------------------------------------------------------------ */
/* Kendi yapay zekâna sor — promptu kullanıcının aracına taşır          */
/*                                                                     */
/* Uygulama yapay zekâ sağlayıcısına bağlanmıyor (bkz. CLAUDE.md).      */
/* Hedef düğmesi aracı yeni sayfada açar ve promptu panoya da kopyalar; */
/* sıra platform/aiHandoff/handoff.ts'te. Hangi sonuçta ne             */
/* söyleneceğine askOwnAiStatus.ts karar verir.                         */
/* ------------------------------------------------------------------ */

/** Geçici geri bildirimin ("Kopyalandı") ekranda kalma süresi. */
const FEEDBACK_MS = 1500;

// as const'un literal tipleri yerine ortak tip; bileşen yalnızca AiTarget bilir.
const TARGETS: readonly AiTarget[] = AI_TARGETS;

function selectAll(field: HTMLTextAreaElement): void {
  field.select();
  // iOS Safari select()'i yok sayıyor, aralığı açıkça ister.
  field.setSelectionRange(0, field.value.length);
}

export type AskOwnAiProps = {
  question: Question;
  /** Kullanıcının gönderdiği cevap. */
  answer: string;
};

export function AskOwnAi({ question, answer }: AskOwnAiProps) {
  const titleId = useId();
  const promptId = useId();
  const prompt = useMemo(() => buildOwnAiPrompt(question, answer), [question, answer]);

  // Oturum boyunca değişmez; mount'ta bir kez okunur.
  const [shareFirst] = useState(() => aiHandoff.canShare());
  const [status, setStatus] = useState<AskOwnAiStatus | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);

  const timerRef = useRef<number | undefined>(undefined);
  /** Son eylemin sırası: önceki bir eylemin geç gelen sonucu mesajı ezmesin. */
  const actionRef = useRef(0);
  /** Alana odak işaretçiyle mi geldi: tıklamanın bıraktığı imleç seçimi bozar. */
  const focusingPointerRef = useRef(false);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  /**
   * Eylem çağıranda, tıklamanın içinde başlamış olmalı (pending); burada
   * yalnızca sonucu beklenir. Önceki mesaj hemen silinir: aynı mesaj
   * tekrar geldiğinde canlı bölge onu yeniden duyursun.
   */
  function track<T>(pending: Promise<T>, toEvent: (value: T) => AskOwnAiEvent): void {
    const action = ++actionRef.current;
    window.clearTimeout(timerRef.current);
    setStatus(null);

    pending
      .then((value) => {
        if (action !== actionRef.current) return;
        const next = askOwnAiStatus(toEvent(value));
        setStatus(next);
        if (next?.revealPrompt) setPromptOpen(true);
        if (next?.transient) {
          timerRef.current = window.setTimeout(() => setStatus(null), FEEDBACK_MS);
        }
      })
      .catch((error: unknown) => {
        // Yalnızca açma fırlatabilir (adapter kopya ve paylaşım hatasını yutuyor).
        if (import.meta.env.DEV) console.warn("[AskOwnAi]", error);
      });
  }

  function handleOpen(target: AiTarget) {
    track(handoff(target, prompt), (outcome) => ({ kind: "handoff", outcome }));
  }

  function handleCopy() {
    track(aiHandoff.copy(prompt), (copied) => ({ kind: "copy", copied }));
  }

  function handleShare() {
    track(aiHandoff.share(prompt), (result) => ({ kind: "share", result }));
  }

  function handlePromptPointerDown(event: PointerEvent<HTMLTextAreaElement>) {
    focusingPointerRef.current = document.activeElement !== event.currentTarget;
  }

  function handlePromptClick(event: MouseEvent<HTMLTextAreaElement>) {
    // Odak tıklamayla geldiyse onFocus'taki seçim imleçle bozuldu; yenile.
    if (focusingPointerRef.current) selectAll(event.currentTarget);
    focusingPointerRef.current = false;
  }

  const copyButton = (
    <button type="button" className={styles.button} onClick={handleCopy}>
      {status?.confirmCopyButton ? "Kopyalandı" : "Promptu kopyala"}
    </button>
  );

  const targetButtons = (
    <div className={styles.grid}>
      {TARGETS.map((target) => (
        <button
          key={target.id}
          type="button"
          className={styles.button}
          // Paylaşım öndeyken hedefler ikincil kalır.
          data-variant={shareFirst ? "quiet" : undefined}
          onClick={() => handleOpen(target)}
        >
          {target.openLabel}
          <span className={styles.srOnly}> (yeni sayfada açılır)</span>
          <ExternalLinkIcon className={styles.icon} />
        </button>
      ))}
    </div>
  );

  return (
    <div className={styles.wrap} role="group" aria-labelledby={titleId}>
      <p className={styles.title} id={titleId}>
        Kendi yapay zekâna sor
      </p>
      <p className={styles.note}>
        Soru, cevabın ve kriterler tek bir promptta. Seçtiğin araçta açılır ve panoya da
        kopyalanır; listede olmayan bir araca yapıştırabilirsin.
      </p>

      {shareFirst ? (
        <>
          <div className={styles.grid}>
            <button type="button" className={styles.button} data-variant="primary" onClick={handleShare}>
              Paylaş
            </button>
            {copyButton}
          </div>
          {targetButtons}
        </>
      ) : (
        <>
          {targetButtons}
          <div className={styles.grid}>{copyButton}</div>
        </>
      )}

      {/* Düğme metninin değişmesi ekran okuyucuya güvenilir biçimde
          ulaşmıyor; sonuç ayrıca canlı bölgeden duyurulur. */}
      <p className={status?.visible ? styles.message : styles.srOnly} role="status">
        {status?.message ?? ""}
      </p>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={promptOpen}
        aria-controls={promptId}
        onClick={() => setPromptOpen((open) => !open)}
      >
        Promptu göster
        <ChevronIcon className={styles.chevron} />
      </button>

      <Collapse open={promptOpen} id={promptId}>
        <textarea
          className={styles.prompt}
          value={prompt}
          readOnly
          rows={8}
          aria-label="Değerlendirme promptu"
          onFocus={(event) => selectAll(event.currentTarget)}
          onPointerDown={handlePromptPointerDown}
          onClick={handlePromptClick}
        />
      </Collapse>
    </div>
  );
}

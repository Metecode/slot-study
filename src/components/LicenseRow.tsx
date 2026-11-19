import { Fragment, useId, useRef } from "react";
import type { ReactNode, SyntheticEvent } from "react";

import { reflowLicenseText } from "./licenseText";
import styles from "./LicenseRow.module.css";
import type { LicenseSection } from "../content/licenses";

/* ------------------------------------------------------------------ */
/* Lisanslar kartında tek satır — <details>, varsayılan kapalı          */
/*                                                                     */
/* Özet: ad, lisans, (varsa) açıklama ve sağda ok. Açılınca tam metin   */
/* satırın altında. Ekran okuyucu için ad aria-label'dan ("Kaynak kod,  */
/* MIT"), durum (daraltılmış/genişletilmiş) tarayıcıdan, açıklama        */
/* aria-describedby'dan: açıklama ada karışsa ad uzun okunurdu.         */
/* ------------------------------------------------------------------ */

export type LicenseRowProps = {
  section: LicenseSection;
};

/** "sahip/repo" gibi adlar "/" sonrasında kırılabilsin (bkz. reelLabel). */
function breakAfterSlashes(name: string): ReactNode {
  const parts = name.split("/");
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ));
}

export function LicenseRow({ section }: LicenseRowProps) {
  const summaryRef = useRef<HTMLElement>(null);
  const descriptionId = useId();

  // Kapanınca içerik kısalır; özet görünümün üstünde kaldıysa kaydırma
  // onu geri getirir, satır gözden kaybolmaz. Görünürdeyse hiçbir şey olmaz.
  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open) summaryRef.current?.scrollIntoView({ block: "nearest" });
  }

  return (
    <details className={styles.row} onToggle={handleToggle}>
      <summary
        ref={summaryRef}
        className={styles.summary}
        aria-label={`${section.name}, ${section.license}`}
        aria-describedby={section.description ? descriptionId : undefined}
      >
        <span className={styles.text}>
          <span className={styles.heading}>
            <span className={styles.name}>{breakAfterSlashes(section.name)}</span>
            <span className={styles.license}>{section.license}</span>
          </span>
          {section.description && (
            <span id={descriptionId} className={styles.description}>
              {section.description}
            </span>
          )}
        </span>
        <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className={styles.content}>
        {section.url && (
          <p className={styles.source}>
            <a className={styles.link} href={section.url} target="_blank" rel="noreferrer">
              {section.license} resmî metni
            </a>
          </p>
        )}
        {/* Elle kırılmış paragraflar akıtılır, başlık ve listeler korunur. */}
        <pre className={styles.licenseText}>{reflowLicenseText(section.text)}</pre>
      </div>
    </details>
  );
}

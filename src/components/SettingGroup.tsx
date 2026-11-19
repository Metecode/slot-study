import { Children, useId } from "react";
import type { ReactNode } from "react";

import styles from "./SettingGroup.module.css";

/* ------------------------------------------------------------------ */
/* Ayarlar grubu — başlık ve kart                                       */
/*                                                                     */
/* role="group" + aria-labelledby: fieldset/legend yerine, çünkü legend */
/* tarayıcıda çerçeveye gömülü çiziliyor ve başlığı kartın dışına almak  */
/* zorlaşıyor. Satırlar platforma göre çizilmeyebilir (Titreşim ve      */
/* hatırlatıcı yalnızca native'de); içi boş kalan grup hiç çizilmez.    */
/* ------------------------------------------------------------------ */

export type SettingGroupProps = {
  title: string;
  children: ReactNode;
};

export function SettingGroup({ title, children }: SettingGroupProps) {
  const titleId = useId();
  // false/null satırlar sayılmaz.
  if (Children.toArray(children).length === 0) return null;

  return (
    <div role="group" aria-labelledby={titleId} className={styles.group}>
      <span id={titleId} className={styles.title}>
        {title}
      </span>
      <div className={styles.card}>{children}</div>
    </div>
  );
}

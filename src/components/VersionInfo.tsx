import { useId, useState } from "react";

import styles from "./VersionInfo.module.css";

/* ------------------------------------------------------------------ */
/* Sürüm — dokununca yanında commit görünür                            */
/* ------------------------------------------------------------------ */

/*
  Commit yalnızca hata bildiriminde işe yarıyor, son kullanıcı için
  gürültü: kapalı gelir. Uzun basma değil düğme: klavyeyle ve ekran
  okuyucuyla da açılsın. Commit düğmenin dışında, seçilip kopyalanabilsin.
*/

export type VersionInfoProps = {
  appVersion: string;
  /** Derleme kaynağı bulunamadıysa boş (bkz. build-info/commitLabel.ts). */
  commitSha: string;
};

export function VersionInfo({ appVersion, commitSha }: VersionInfoProps) {
  const [commitVisible, setCommitVisible] = useState(false);
  const commitId = useId();
  const version = `v${appVersion}`;

  // Gösterilecek commit yoksa düğme de yok: hiçbir şey yapmayan bir kontrol olurdu.
  if (!commitSha) return <span className={styles.version}>{version}</span>;

  return (
    <span className={styles.group}>
      <button
        type="button"
        className={`${styles.version} ${styles.button}`}
        aria-label={`${version}, derleme kodu`}
        aria-expanded={commitVisible}
        aria-controls={commitId}
        onClick={() => setCommitVisible((visible) => !visible)}
      >
        {version}
      </button>
      <code id={commitId} className={styles.commit} hidden={!commitVisible}>
        {commitSha}
      </code>
    </span>
  );
}

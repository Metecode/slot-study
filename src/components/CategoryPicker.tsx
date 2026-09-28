import { useId, useState } from "react";

import { ChevronIcon } from "./ChevronIcon";
import { Collapse } from "./Collapse";
import { CATEGORY_LABELS } from "../content/labels";
import { summarizeCategories } from "../domain/categorySummary";
import type { Category } from "../domain/question";
import styles from "./CategoryPicker.module.css";

/* ------------------------------------------------------------------ */
/* Kategori seçimi — çekiliş havuzunu daraltır                         */
/* ------------------------------------------------------------------ */

export type CategoryPickerProps = {
  /** Gösterilecek kategoriler. İçinde soru olmayan kategori buraya hiç gelmez. */
  categories: Category[];
  active: Category[];
  /** Seçili kategorilerdeki soru sayısı; çekilişin havuzu. Özette yazılır. */
  poolCount: number;
  /** true iken hiçbir çip tıklanamaz (ör. makara dönerken). */
  disabled: boolean;
  onToggle: (category: Category) => void;
  /** Tümünü seç / tümünü kaldır arasında geçiş yapar. */
  onToggleAll: () => void;
};

export function CategoryPicker({
  categories,
  active,
  poolCount,
  disabled,
  onToggle,
  onToggleAll,
}: CategoryPickerProps) {
  // Kalıcı olması gerekmiyor: her açılışta kapalı başlar.
  const [open, setOpen] = useState(false);
  const listId = useId();
  // Uzunluk karşılaştırması yetmez: seçimde, artık gösterilmeyen bir
  // kategori kalmış olabilir.
  const allSelected =
    categories.length > 0 && categories.every((category) => active.includes(category));

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.summary}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
        >
          {/* Havuzdaki soru sayısı özetin içinde ("6 kategori · 13 soru").
              Canlı bölge değil: çip değiştikçe okunması gereken bir şey yok;
              düğmenin adının parçası olduğu için odakta okunur. */}
          <span>{summarizeCategories(active, categories, poolCount)}</span>
          <ChevronIcon className={styles.chevron} />
        </button>

        {/* Satıra sığmazsa alt satıra iner; orada metni özet pill'inin
            metniyle aynı sol çizgide başlar (bkz. .selectAll). */}
        <span className={styles.actions}>
          {/* Açık/kapalı fark etmeden erişilebilir olsun diye özet
              düğmesinin yanında, koleksiyonun içine gömülü değil. */}
          <button
            type="button"
            className={styles.selectAll}
            disabled={disabled}
            onClick={onToggleAll}
          >
            {allSelected ? "Tümünü kaldır" : "Tümünü seç"}
          </button>
        </span>
      </div>

      <Collapse open={open} id={listId}>
        <ul className={styles.list}>
          {categories.map((category) => {
            const selected = active.includes(category);
            return (
              <li key={category}>
                {/* button: klavye ile Tab/Enter/Space doğal olarak çalışır. */}
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => onToggle(category)}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              </li>
            );
          })}
        </ul>
      </Collapse>
    </div>
  );
}

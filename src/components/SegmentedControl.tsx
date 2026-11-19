import { useId, useRef } from "react";
import type { KeyboardEvent } from "react";

import styles from "./SegmentedControl.module.css";

/* ------------------------------------------------------------------ */
/* Bölmeli seçim — birden fazla seçenekten biri (radio grubu)           */
/* ------------------------------------------------------------------ */

/*
  WAI-ARIA radio grubu deseni: grup tek sekme durağı, seçili seçenek
  odaklanabilir (gezici tabindex). Ok tuşları seçimi kaydırır ve odağı
  taşır; Home/End uçlara gider. Seçim odağı izler, ayrıca Enter gerekmez.
*/

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  const labelId = useId();
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    buttonsRef.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1;
    const next: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    select(next[event.key]);
  }

  return (
    <span className={styles.row}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <span role="radiogroup" aria-labelledby={labelId} className={styles.group}>
        {options.map((option, index) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                buttonsRef.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className={styles.option}
              onClick={() => select(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {option.label}
            </button>
          );
        })}
      </span>
    </span>
  );
}

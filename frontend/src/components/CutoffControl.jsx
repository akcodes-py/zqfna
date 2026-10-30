import { CUTOFFS } from "../lib/cutoff";

export function CutoffControl({ value, onChange }) {
  return (
    <div className="field">
      <span className="field__label" id="cutoff-label">Decision cutoff</span>
      <div className="segmented" role="radiogroup" aria-labelledby="cutoff-label">
        {CUTOFFS.map((c) => (
          <button
            key={c.offset}
            role="radio"
            aria-checked={value === c.offset}
            className="segmented__item"
            title={c.detail}
            onClick={() => onChange(c.offset)}
          >
            {c.label}
            <span className="segmented__sub">{c.short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

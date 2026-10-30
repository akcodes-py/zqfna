export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const fmtMW = (v, digits = 0) =>
  v == null || Number.isNaN(v) ? "—" : Number(v).toLocaleString("en-GB", { maximumFractionDigits: digits });

export const fmtMW = (v, digits = 0) =>
  v == null || Number.isNaN(v) ? "—" : Number(v).toLocaleString("en-GB", { maximumFractionDigits: digits });

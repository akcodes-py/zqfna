export const CUTOFFS = [
  {
    offset: 13,
    label: "Gate closure",
    short: "11:00 UTC on D-1",
    detail: "11:00 UTC on the day before delivery, around when the day-ahead auction closes. Strictest and closest to what the desk really had.",
  },
  {
    offset: 0,
    label: "Midnight",
    short: "00:00 UTC on D",
    detail: "00:00 UTC at the start of the delivery day. Lets in forecasts published after the auction closed, so accuracy looks slightly better.",
  },
];

export const cutoffFor = (offset) => CUTOFFS.find((c) => c.offset === offset) ?? CUTOFFS[0];

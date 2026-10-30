// All timestamps from the API are UTC. Format with an explicit UTC zone so the
// UI never silently shifts to the viewer's local timezone.
const make = (opts) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts });

const dayLong = make({ weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const dayShort = make({ day: "2-digit", month: "short" });
const dayTick = make({ month: "short", day: "numeric" });
const stamp = make({ day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const toDate = (value) => new Date(value.length === 10 ? `${value}T00:00:00Z` : value);

export const formatDayLong = (v) => dayLong.format(toDate(v)).replace(",", "");
export const formatDayShort = (v) => dayShort.format(toDate(v));
export const formatDayTick = (v) => dayTick.format(toDate(v));
export const formatStamp = (v) => stamp.format(toDate(v)).replace(",", "");
// "2026-01-15T05:30:00Z" -> "05:30"
export const formatClock = (iso) => iso.slice(11, 16);

export const JANUARY_DAYS = Array.from({ length: 31 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);
export const DATA_MONTH = "2026-01";
export const MONTHS_2026 = Array.from({ length: 12 }, (_, i) => {
  const month = String(i + 1).padStart(2, "0");
  return `2026-${month}`;
});

export function formatMonth(value) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(toDate(`${value}-01`));
}

export function shiftDay(date, delta) {
  const idx = JANUARY_DAYS.indexOf(date) + delta;
  return JANUARY_DAYS[idx] ?? date;
}

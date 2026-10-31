import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatClock, formatDayTick } from "../lib/time";
import { EmptyState, LoadingSkeleton } from "./UI";

// Professional palette: cyan actuals, emerald forecasts, amber shortage risk,
// blue excess-cost risk, and indigo signed bias.
const C = {
  actual: "var(--chart-actual)",
  forecast: "var(--chart-forecast)",
  over: "var(--chart-over)",
  under: "var(--chart-under)",
  bias: "var(--chart-bias)",
};

const MARGIN = { top: 8, right: 16, left: 4, bottom: 4 };
const grid = { stroke: "var(--chart-grid)", vertical: false };
const axisBase = { tick: { fill: "var(--chart-axis)", fontSize: 11 }, tickLine: false, axisLine: { stroke: "var(--chart-grid)" } };
const zeroLine = <ReferenceLine y={0} stroke="var(--chart-grid)" />;

const num = (v) => Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
const signed = (v) => `${v > 0 ? "+" : ""}${num(v)}`;

const mwAxis = (extra = {}) => ({
  ...axisBase,
  width: 56,
  tickFormatter: num,
  label: { value: "MW", position: "insideTopLeft", offset: -4, fill: "var(--chart-axis)", fontSize: 11, dy: -8, dx: 12 },
  ...extra,
});

const legendProps = {
  verticalAlign: "top",
  align: "right",
  height: 28,
  iconType: "plainline",
  wrapperStyle: { fontSize: 12 },
  formatter: (value) => <span style={{ color: "var(--chart-legend)" }}>{value}</span>,
};

const tipBox = {
  background: "var(--surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
  minWidth: 150,
};

function TipShell({ title, rows }) {
  return (
    <div style={tipBox}>
      {title && <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>{title}</div>}
      {rows.map((r) => (
        <div key={r.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: r.color, marginTop: 2 }}>
          <span>{r.name}</span>
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>{r.value}</strong>
        </div>
      ))}
    </div>
  );
}

// Generic tooltip for line/bar series; `fmt` formats each value.
function SeriesTip({ active, payload, label, fmt = (v) => `${num(v)} MW`, titleFmt = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <TipShell
      title={titleFmt(label)}
      rows={payload.map((p) => ({ name: p.name, color: p.color ?? p.fill, value: fmt(p.value, p) }))}
    />
  );
}

function ChartFrame({ label, children }) {
  return (
    <div className="chart-frame" role="img" aria-label={label}>
      {children}
    </div>
  );
}

const Loading = ({ h, text }) => <LoadingSkeleton height={h} label={text} />;
const Empty = ({ h, text = "No data available" }) => <EmptyState height={h}>{text}</EmptyState>;

/* -------------------------------------------------------------------------- */
/* 1. Forecast vs actual over one day: line chart, no smoothing, 0-based axis. */
/* -------------------------------------------------------------------------- */
export function ForecastChart({ data, loading }) {
  if (loading) return <Loading h={340} text="Loading forecast chart…" />;
  if (!data?.length) return <Empty h={340} text="No data for selected date" />;

  const rows = data.map((d) => ({
    time: formatClock(d.start_time),
    actual: d.actual_mw,
    forecast: d.forecast_mw,
  }));

  return (
    <ChartFrame label="Line chart of actual and forecast wind generation in megawatts over the delivery day">
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={rows} margin={MARGIN}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="time" {...axisBase} interval={5} />
          <YAxis {...mwAxis()} domain={[0, (max) => Math.ceil(max / 2000) * 2000]} />
          <Tooltip content={<SeriesTip />} cursor={{ stroke: "rgba(148,163,184,0.35)" }} />
          <Legend {...legendProps} />
          <Line
            type="linear"
            dataKey="actual"
            name="Actual"
            stroke={C.actual}
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="forecast"
            name="Forecast"
            stroke={C.forecast}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Daily MAE (magnitude, bars) and bias (signed, markers + line).           */
/* -------------------------------------------------------------------------- */
export function DailyMAEChart({ data, loading }) {
  if (loading) return <Loading h={280} text="Loading daily accuracy…" />;
  if (!data?.length) return <Empty h={280} />;

  const rows = data.map((d) => ({ date: d.delivery_date, mae: d.daily_mae, bias: d.daily_bias }));

  return (
    <ChartFrame label="Bar chart of daily mean absolute error with a line for daily bias, in megawatts">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={rows} margin={MARGIN}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="date" {...axisBase} interval={2} tickFormatter={formatDayTick} />
          <YAxis {...mwAxis()} />
          {zeroLine}
          <Tooltip
            content={<SeriesTip titleFmt={formatDayTick} fmt={(v, p) => (p.dataKey === "bias" ? `${signed(v)} MW` : `${num(v)} MW`)} />}
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
          />
          <Legend {...legendProps} />
          <Bar dataKey="mae" name="MAE" fill={C.forecast} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          <Line
            type="linear"
            dataKey="bias"
            name="Bias (+ over-forecast)"
            stroke={C.bias}
            strokeWidth={1.75}
            dot={{ r: 2.5, fill: C.bias, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Hour-of-day profile: MAE bars + bias line (same units, same axis).       */
/* -------------------------------------------------------------------------- */
export function HourlyErrorChart({ data, loading }) {
  if (loading) return <Loading h={260} text="Loading hourly profile…" />;
  if (!data?.length) return <Empty h={260} />;

  const rows = data.map((d) => ({ hour: `${String(d.hour).padStart(2, "0")}:00`, mae: d.hourly_mae, bias: d.hourly_bias }));

  return (
    <ChartFrame label="Bar chart of mean absolute error by hour of day with a bias line, in megawatts">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows} margin={MARGIN}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="hour" {...axisBase} interval={1} tick={{ fill: "var(--chart-axis)", fontSize: 10 }} />
          <YAxis {...mwAxis()} />
          {zeroLine}
          <Tooltip
            content={<SeriesTip titleFmt={(l) => `${l} UTC`} fmt={(v, p) => (p.dataKey === "bias" ? `${signed(v)} MW` : `${num(v)} MW`)} />}
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
          />
          <Legend {...legendProps} />
          <Bar dataKey="mae" name="MAE" fill={C.actual} fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          <Line
            type="linear"
            dataKey="bias"
            name="Bias (+ over-forecast)"
            stroke={C.bias}
            strokeWidth={1.75}
            dot={{ r: 2.5, fill: C.bias, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Error distribution: a real histogram.                                    */
/*    Bins are [lo, lo+width). Bins below 0 are under-forecast, bins from 0    */
/*    upward are over-forecast, so no bin is ever "neutral".                   */
/* -------------------------------------------------------------------------- */
const BIN = 250;

function buildBins(errors) {
  const lo = Math.floor(Math.min(...errors) / BIN) * BIN;
  const hi = Math.floor(Math.max(...errors) / BIN) * BIN;
  const bins = [];
  for (let start = lo; start <= hi; start += BIN) bins.push({ start, end: start + BIN, count: 0 });
  errors.forEach((e) => {
    bins[Math.floor((e - lo) / BIN)].count += 1;
  });
  return bins.map((b) => ({ ...b, share: (b.count / errors.length) * 100 }));
}

function HistTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  const side = b.start >= 0 ? "Over-forecast" : "Under-forecast";
  return (
    <TipShell
      title={`${signed(b.start)} to ${signed(b.end)} MW`}
      rows={[
        { name: side, color: b.start >= 0 ? C.over : C.under, value: "" },
        { name: "Intervals", color: "var(--text)", value: num(b.count) },
        { name: "Share", color: "var(--text)", value: `${b.share.toFixed(1)}%` },
      ]}
    />
  );
}

export function ErrorHistogram({ data, loading }) {
  if (loading) return <Loading h={300} text="Loading error distribution…" />;
  if (!data?.length) return <Empty h={300} />;

  const bins = buildBins(data.map((d) => d.error_mw));
  // Only label every 4th bin start (every 1,000 MW) so ticks stay readable.
  const showTick = (v) => v % 1000 === 0;

  return (
    <ChartFrame label="Histogram of forecast errors in megawatts; red bars are over-forecast, blue bars are under-forecast">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={bins} margin={{ ...MARGIN, bottom: 18 }} barCategoryGap={0} barGap={0}>
          <CartesianGrid {...grid} />
          <XAxis
            dataKey="start"
            {...axisBase}
            interval={0}
            tickFormatter={(v) => (showTick(v) ? signed(v) : "")}
            label={{ value: "Forecast − actual (MW)", position: "insideBottom", offset: -12, fill: "var(--chart-axis)", fontSize: 11 }}
          />
          <YAxis
            {...axisBase}
            width={56}
            tickFormatter={num}
            label={{ value: "Intervals", angle: -90, position: "insideLeft", offset: 8, fill: "var(--chart-axis)", fontSize: 11 }}
          />
          <Tooltip content={<HistTip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
          <Bar dataKey="count" isAnimationActive={false} stroke="var(--surface)" strokeWidth={1}>
            {bins.map((b) => (
              <Cell key={b.start} fill={b.start >= 0 ? C.over : C.under} fillOpacity={0.9} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Forecast vs actual scatter: square plot, identical axes, 45° diagonal.   */
/* -------------------------------------------------------------------------- */
function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TipShell
      rows={[
        { name: "Actual", color: C.actual, value: `${num(p.actual)} MW` },
        { name: "Forecast", color: C.forecast, value: `${num(p.forecast)} MW` },
        { name: "Error", color: p.error > 0 ? C.over : C.under, value: `${signed(p.error)} MW` },
      ]}
    />
  );
}

export function CalibrationChart({ data, loading }) {
  if (loading) return <Loading h={320} text="Loading scatter plot…" />;
  if (!data?.length) return <Empty h={320} />;

  const points = data.map((d) => ({ actual: d.actual_mw, forecast: d.forecast_mw, error: d.error_mw }));
  const max = Math.ceil(Math.max(...points.map((p) => Math.max(p.actual, p.forecast))) / 2000) * 2000;
  const axis = { type: "number", domain: [0, max], tickCount: 5, tickFormatter: num, ...axisBase };

  return (
    <ChartFrame label="Scatter plot of forecast against actual wind generation; points above the diagonal were over-forecast">
      <ResponsiveContainer width="100%" aspect={1} maxHeight={360}>
        <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 22 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.12)" />
          <XAxis {...axis} dataKey="actual" name="Actual" label={{ value: "Actual (MW)", position: "insideBottom", offset: -14, fill: "var(--chart-axis)", fontSize: 11 }} />
          <YAxis {...axis} dataKey="forecast" name="Forecast" width={56} label={{ value: "Forecast (MW)", angle: -90, position: "insideLeft", offset: 6, fill: "var(--chart-axis)", fontSize: 11 }} />
          <ZAxis range={[14, 14]} />
          <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: "3 3", stroke: "rgba(148,163,184,0.4)" }} />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: max, y: max }]}
            stroke="var(--chart-reference)"
            strokeDasharray="6 4"
            ifOverflow="visible"
          />
          <Scatter data={points} fill={C.actual} fillOpacity={0.4} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

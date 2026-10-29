import React, { useState, useMemo } from "react";
import {
  ComposedChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Scatter, Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { LoadingSkeleton } from "./UI";

const COLORS = {
  actual: "#14b8a6",
  forecast: "#f59e0b",
  error: "#f43f5e",
  bias: "#8b5cf6",
};

// ── Shared custom tooltip ───────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(15,23,42,0.95)",
        border: "1px solid rgba(71,85,105,0.6)",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        backdropFilter: "blur(8px)",
      }}
    >
      <p style={{ margin: "0 0 6px", color: "#94a3b8", fontWeight: 600 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#cbd5e1" }}>{p.name}:</span>
          <span style={{ color: "#f1f5f9", fontWeight: 600 }}>
            {formatter ? formatter(p.value) : p.value?.toFixed(0)} MW
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 1. Forecast vs Actual time-series chart ─────────────────────────────────────

export function ForecastChart({ data, loading }) {
  if (loading) return <LoadingSkeleton height={320} label="Loading forecast chart..." />;
  if (!data?.length) return (
    <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
      No data for selected date
    </div>
  );

  const chartData = data.map((d) => ({
    time: format(parseISO(d.start_time), "HH:mm"),
    actual: d.actual_mw,
    forecast: d.forecast_mw,
    error: d.error_mw,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.actual} stopOpacity={0.25} />
            <stop offset="95%" stopColor={COLORS.actual} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
        <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} interval={5} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} unit=" MW" width={70} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          formatter={(value) => <span style={{ color: "#94a3b8" }}>{value}</span>}
        />
        <Area
          type="monotone"
          dataKey="actual"
          name="Actual Generation"
          stroke={COLORS.actual}
          strokeWidth={2}
          fill="url(#actualGrad)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Forecast (D-1)"
          stroke={COLORS.forecast}
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── 2. Daily MAE bar chart ──────────────────────────────────────────────────────

export function DailyMAEChart({ data, loading }) {
  if (loading) return <LoadingSkeleton height={260} label="Loading daily accuracy..." />;
  if (!data?.length) return null;

  const chartData = data.map((d) => ({
    date: format(parseISO(d.delivery_date + "T00:00:00Z"), "Jan d"),
    mae: d.daily_mae,
    bias: d.daily_bias,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
        <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} interval={2} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} unit=" MW" width={70} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(71,85,105,0.5)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
                <p style={{ margin: "0 0 6px", color: "#94a3b8", fontWeight: 600 }}>{label}</p>
                {payload.map((p) => (
                  <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
                    {p.name}: <strong>{p.value?.toFixed(0)} MW</strong>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span style={{ color: "#94a3b8" }}>{v}</span>} />
        <Bar dataKey="mae" name="Daily MAE" fill={COLORS.forecast} fillOpacity={0.8} radius={[4, 4, 0, 0]} />
        <Line type="monotone" dataKey="bias" name="Bias" stroke={COLORS.bias} strokeWidth={2} dot={false} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── 3. Hourly bias heatmap-style bar chart ──────────────────────────────────────

export function HourlyErrorChart({ data, loading }) {
  if (loading) return <LoadingSkeleton height={240} label="Loading hourly profile..." />;
  if (!data?.length) return null;

  const chartData = data.map((d) => ({
    hour: `${String(d.hour).padStart(2, "0")}:00`,
    mae: d.hourly_mae,
    bias: d.hourly_bias,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
        <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} interval={2} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} unit=" MW" width={70} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(71,85,105,0.5)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
                <p style={{ margin: "0 0 6px", color: "#94a3b8", fontWeight: 600 }}>Hour {label}</p>
                {payload.map((p) => (
                  <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
                    {p.name}: <strong>{p.value?.toFixed(0)} MW</strong>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => <span style={{ color: "#94a3b8" }}>{v}</span>} />
        <Bar dataKey="mae" name="Hourly MAE" fill={COLORS.actual} fillOpacity={0.75} radius={[3, 3, 0, 0]} />
        <Line type="monotone" dataKey="bias" name="Bias" stroke={COLORS.error} strokeWidth={2} dot={false} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── 4. Scatter: Forecast vs Actual ─────────────────────────────────────────────

export function ScatterChart({ data, loading }) {
  if (loading) return <LoadingSkeleton height={280} label="Loading scatter plot..." />;
  if (!data?.length) return null;

  const scatterData = data.map((d) => ({
    actual: Math.round(d.actual_mw),
    forecast: Math.round(d.forecast_mw),
  }));

  const maxVal = Math.max(...scatterData.map((d) => Math.max(d.actual, d.forecast))) * 1.05;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
        <XAxis
          type="number"
          dataKey="actual"
          name="Actual"
          domain={[0, maxVal]}
          tick={{ fill: "#64748b", fontSize: 11 }}
          label={{ value: "Actual (MW)", position: "insideBottom", offset: -10, fill: "#64748b", fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="forecast"
          name="Forecast"
          domain={[0, maxVal]}
          tick={{ fill: "#64748b", fontSize: 11 }}
          label={{ value: "Forecast (MW)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
          width={75}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(71,85,105,0.5)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
                <div style={{ color: COLORS.actual }}>Actual: <strong>{d?.actual} MW</strong></div>
                <div style={{ color: COLORS.forecast }}>Forecast: <strong>{d?.forecast} MW</strong></div>
                <div style={{ color: "#64748b", fontSize: 11 }}>Error: {((d?.forecast - d?.actual) || 0).toFixed(0)} MW</div>
              </div>
            );
          }}
        />
        {/* Perfect forecast line */}
        <Line
          data={[{ actual: 0, forecast: 0 }, { actual: maxVal, forecast: maxVal }]}
          type="linear"
          dataKey="forecast"
          stroke="rgba(255,255,255,0.2)"
          strokeDasharray="6 3"
          dot={false}
          legendType="none"
        />
        <Scatter data={scatterData} fill={COLORS.teal} fillOpacity={0.6} name="Intervals" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── 5. Error distribution histogram ────────────────────────────────────────────

export function ErrorHistogram({ data, loading }) {
  if (loading) return <LoadingSkeleton height={240} label="Loading error distribution..." />;
  if (!data?.length) return null;

  // Bucket errors into bins of 200 MW
  const errors = data.map((d) => d.error_mw);
  const binSize = 200;
  const min = Math.floor(Math.min(...errors) / binSize) * binSize;
  const max = Math.ceil(Math.max(...errors) / binSize) * binSize;

  const bins = {};
  for (let b = min; b <= max; b += binSize) {
    bins[b] = 0;
  }
  errors.forEach((e) => {
    const bin = Math.floor(e / binSize) * binSize;
    bins[bin] = (bins[bin] || 0) + 1;
  });

  const chartData = Object.entries(bins).map(([bin, count]) => ({
    bin: `${parseInt(bin) > 0 ? "+" : ""}${bin}`,
    count,
    rawBin: parseInt(bin),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
        <XAxis dataKey="bin" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }} width={55} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(71,85,105,0.5)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
                <p style={{ margin: "0 0 4px", color: "#94a3b8" }}>Error bin: {label} MW</p>
                <p style={{ margin: 0, color: COLORS.error }}>{payload[0]?.value} intervals</p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" name="Frequency" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.rawBin < 0 ? "#0ea5e9" : entry.rawBin > 0 ? "#f43f5e" : "#14b8a6"}
            />
          ))}
        </Bar>
        <ReferenceLine x="0" stroke="rgba(255,255,255,0.3)" strokeDasharray="4 2" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

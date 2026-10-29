import React, { useState, useMemo } from "react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { CalendarDays, Clock, Info, ChevronDown } from "lucide-react";
import { useMatchedData } from "../hooks/useWindData";
import { ForecastChart } from "./Charts";
import { MetricCard, SectionHeader, LoadingSkeleton, ErrorBanner, Tag } from "./UI";

// January 2026 delivery days
const JAN_DATES = eachDayOfInterval({
  start: new Date(2026, 0, 1),
  end: new Date(2026, 0, 31),
}).map((d) => format(d, "yyyy-MM-dd"));

export function ForecastView() {
  const [selectedDate, setSelectedDate] = useState("2026-01-15");
  const { data, vintages, loading, error } = useMatchedData(selectedDate);

  const summary = useMemo(() => {
    if (!data?.length) return null;
    const actuals = data.map((d) => d.actual_mw);
    const forecasts = data.map((d) => d.forecast_mw);
    return {
      peakActual: Math.round(Math.max(...actuals)),
      avgActual: Math.round(actuals.reduce((a, b) => a + b, 0) / actuals.length),
      peakForecast: Math.round(Math.max(...forecasts)),
      avgError: Math.round(data.reduce((a, b) => a + Math.abs(b.error_mw), 0) / data.length),
      decisionVintage: vintages?.decision_vintage,
      decisionCutoff: vintages?.decision_cutoff,
    };
  }, [data, vintages]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#f1f5f9" }}>
          Wind Generation Forecast
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b", maxWidth: 600 }}>
          View the latest available forecast for a given delivery day, using only data
          published before the day-ahead market decision cutoff.
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 32,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="delivery-date-select"
            style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            Delivery Date
          </label>
          <div style={{ position: "relative" }}>
            <CalendarDays
              size={14}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b" }}
            />
            <select
              id="delivery-date-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                background: "rgba(30,41,59,0.8)",
                border: "1px solid rgba(71,85,105,0.5)",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 13,
                padding: "8px 32px 8px 30px",
                cursor: "pointer",
                outline: "none",
                appearance: "none",
                minWidth: 160,
              }}
            >
              {JAN_DATES.map((d) => (
                <option key={d} value={d}>
                  {format(parseISO(d + "T00:00:00Z"), "EEE, dd MMM yyyy")}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}
            />
          </div>
        </div>

        {/* Decision vintage info */}
        {summary?.decisionVintage && (
          <div
            style={{
              background: "rgba(20,184,166,0.08)",
              border: "1px solid rgba(20,184,166,0.25)",
              borderRadius: 10,
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
            }}
          >
            <Clock size={14} color="#14b8a6" />
            <span style={{ color: "#94a3b8" }}>Forecast used for decision:</span>
            <span style={{ color: "#14b8a6", fontWeight: 600 }}>
              Published {format(parseISO(summary.decisionVintage), "dd MMM HH:mm")} UTC
            </span>
            <Tag label="Pre-cutoff" color="#14b8a6" />
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Summary metric cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <MetricCard
          label="Peak Actual Generation"
          value={summary?.peakActual?.toLocaleString() ?? "—"}
          unit="MW"
          subtitle="Highest 30-min wind output on this day"
          color="teal"
        />
        <MetricCard
          label="Average Actual Output"
          value={summary?.avgActual?.toLocaleString() ?? "—"}
          unit="MW"
          subtitle="Mean wind generation across the day"
          color="sky"
        />
        <MetricCard
          label="Peak Forecast"
          value={summary?.peakForecast?.toLocaleString() ?? "—"}
          unit="MW"
          subtitle="Highest forecast value from selected vintage"
          color="amber"
        />
        <MetricCard
          label="Day MAE"
          value={summary?.avgError?.toLocaleString() ?? "—"}
          unit="MW"
          subtitle="Mean absolute error for this day"
          color="rose"
        />
      </div>

      {/* Main chart */}
      <div
        style={{
          background: "rgba(15,23,42,0.7)",
          border: "1px solid rgba(71,85,105,0.3)",
          borderRadius: 16,
          padding: "24px",
          marginBottom: 24,
        }}
      >
        <SectionHeader
          title="Forecast vs Actual Wind Generation"
          subtitle={`${selectedDate} — 30-minute intervals (UTC). Forecast = latest vintage published before midnight on ${format(parseISO(selectedDate + "T00:00:00Z"), "dd MMM")}.`}
        />
        <ForecastChart data={data} loading={loading} />
      </div>

      {/* Leakage explanation */}
      <div
        style={{
          background: "rgba(14,165,233,0.06)",
          border: "1px solid rgba(14,165,233,0.2)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <Info size={16} color="#0ea5e9" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
          <strong style={{ color: "#e2e8f0" }}>How forecast selection works: </strong>
          For delivery day D, the decision cutoff is midnight UTC at the start of day D (end of D-1).
          We select the <em>latest WINDFOR vintage published strictly before this cutoff</em> — ensuring no
          future information is used in the comparison. This mirrors real day-ahead market practice.
        </div>
      </div>
    </div>
  );
}

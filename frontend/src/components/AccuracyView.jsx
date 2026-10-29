import React from "react";
import { AlertTriangle, TrendingUp, Info } from "lucide-react";
import { useAccuracy, useAllMatched } from "../hooks/useWindData";
import { DailyMAEChart, HourlyErrorChart, ErrorHistogram } from "./Charts";
import { MetricCard, SectionHeader, LoadingSkeleton, ErrorBanner } from "./UI";

function InterpretationBox({ bias, mae, rmse }) {
  if (!mae) return null;
  const overUnder = bias > 0 ? "over-forecasts" : "under-forecasts";
  const riskMsg =
    bias < 0
      ? "Under-forecasting wind means the team may not buy enough backup power — higher procurement risk."
      : "Over-forecasting wind means more backup power than needed is purchased — extra cost but lower shortage risk.";

  return (
    <div
      style={{
        background: "rgba(139,92,246,0.07)",
        border: "1px solid rgba(139,92,246,0.25)",
        borderRadius: 14,
        padding: "20px 24px",
        marginBottom: 28,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <TrendingUp size={18} color="#8b5cf6" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
            What these numbers mean for procurement
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>
            <li>
              The forecasting system <strong style={{ color: "#e2e8f0" }}>{overUnder}</strong> wind generation
              by <strong style={{ color: "#8b5cf6" }}>{Math.abs(bias)?.toFixed(0)} MW on average</strong> (bias).
            </li>
            <li>
              The typical error (MAE) is <strong style={{ color: "#f59e0b" }}>{mae?.toFixed(0)} MW</strong> — your
              procurement team should plan for this as a <em>minimum buffer</em> when buying from the day-ahead market.
            </li>
            <li>
              RMSE ({rmse?.toFixed(0)} MW) is higher than MAE, indicating occasional large errors — tail risk matters.
            </li>
            <li>{riskMsg}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function AccuracyView() {
  const { data: accuracyData, loading: accLoading, error: accError } = useAccuracy();
  const { data: matchedData, loading: matchLoading, error: matchError } = useAllMatched();

  // useAccuracy fetches aggregate, daily, hourly in parallel and returns { aggregate, daily, hourly }
  const agg = accuracyData?.aggregate;
  const daily = accuracyData?.daily;
  const hourly = accuracyData?.hourly;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#f1f5f9" }}>
          Forecast Accuracy Analysis
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b", maxWidth: 640 }}>
          Quantitative assessment of WINDFOR forecast accuracy across January 2026.
          All metrics computed against the best pre-decision-cutoff forecast to avoid data leakage.
        </p>
      </div>

      {(accError || matchError) && <ErrorBanner message={accError || matchError} />}

      {/* Aggregate metrics */}
      <SectionHeader
        title="January 2026 — Aggregate Metrics"
        subtitle={`Computed over ${agg?.n_matched?.toLocaleString() ?? "..."} matched 30-min intervals`}
      />
      {accLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {[...Array(4)].map((_, i) => <LoadingSkeleton key={i} height={100} />)}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <MetricCard
            label="MAE — Mean Absolute Error"
            value={agg?.mae_mw?.toLocaleString() ?? "—"}
            unit="MW"
            subtitle="Average absolute forecast error. Minimum procurement buffer needed."
            color="amber"
          />
          <MetricCard
            label="RMSE — Root Mean Square Error"
            value={agg?.rmse_mw?.toLocaleString() ?? "—"}
            unit="MW"
            subtitle="Penalises large errors. High vs MAE = occasional big surprises."
            color="rose"
          />
          <MetricCard
            label="Bias — Systematic Error"
            value={`${agg?.bias_mw > 0 ? "+" : ""}${agg?.bias_mw?.toLocaleString() ?? "—"}`}
            unit="MW"
            subtitle="Positive = over-forecast wind. Negative = under-forecast (higher risk)."
            color="violet"
          />
          <MetricCard
            label="MAPE — % Error"
            value={agg?.mape_pct?.toFixed(1) ?? "—"}
            unit="%"
            subtitle="Scale-free error rate. Useful for benchmarking."
            color="sky"
          />
        </div>
      )}

      {/* Interpretation */}
      <InterpretationBox bias={agg?.bias_mw} mae={agg?.mae_mw} rmse={agg?.rmse_mw} />

      {/* Daily MAE trend */}
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
          title="Daily MAE & Bias Trend"
          subtitle="Bars show daily mean absolute error. Line shows systematic daily bias."
        />
        <DailyMAEChart data={daily} loading={accLoading} />
      </div>

      {/* Hourly profile + Error histogram */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <div
          style={{
            background: "rgba(15,23,42,0.7)",
            border: "1px solid rgba(71,85,105,0.3)",
            borderRadius: 16,
            padding: "24px",
          }}
        >
          <SectionHeader
            title="Error by Hour of Day"
            subtitle="Reveals intra-day systematic biases in the forecast model."
          />
          <HourlyErrorChart data={hourly} loading={accLoading} />
        </div>
        <div
          style={{
            background: "rgba(15,23,42,0.7)",
            border: "1px solid rgba(71,85,105,0.3)",
            borderRadius: 16,
            padding: "24px",
          }}
        >
          <SectionHeader
            title="Error Distribution"
            subtitle="Frequency of forecast errors by magnitude. Blue = under-forecast, red = over-forecast."
          />
          <ErrorHistogram data={matchedData} loading={matchLoading} />
        </div>
      </div>

      {/* Methodology note */}
      <div
        style={{
          background: "rgba(15,23,42,0.5)",
          border: "1px solid rgba(71,85,105,0.2)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <Info size={15} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          <strong style={{ color: "#94a3b8" }}>Methodology: </strong>
          For each 30-min delivery interval in January 2026, we join the FUELHH actual WIND generation
          with the latest WINDFOR forecast published <em>strictly before midnight at the start of that delivery day</em>.
          Error = Forecast − Actual. Intervals with no valid pre-cutoff forecast are excluded from metrics.
          Data source: Elexon BMRS API (public).
        </p>
      </div>
    </div>
  );
}

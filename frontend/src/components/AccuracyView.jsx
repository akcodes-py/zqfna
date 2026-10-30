import { useMemo } from "react";
import { Activity, CalendarRange, Lightbulb, ShieldAlert, Target } from "lucide-react";
import { useAccuracy, useAllMatched } from "../hooks/useWindData";
import { DATA_MONTH, MONTHS_2026, formatDayShort, formatMonth } from "../lib/time";
import { fmtMW, percentile } from "../lib/stats";
import { CalibrationChart, DailyMAEChart, ErrorHistogram, HourlyErrorChart } from "./Charts";
import { CutoffControl } from "./CutoffControl";
import { cutoffFor } from "../lib/cutoff";
import { Callout, SlowNotice, Card, ChartBoundary, EmptyState, ErrorBanner, LoadingSkeleton, MetricCard, PageHeader, SectionTitle, UnavailableState } from "./UI";
import { LazySignalScene } from "./LazySignalScene";

// error = forecast − actual.  Positive ⇒ wind over-forecast ⇒ desk under-buys thermal ⇒ SHORTAGE risk.
// Negative ⇒ wind under-forecast ⇒ desk over-buys thermal ⇒ EXCESS cost.
function Insights({ agg, p90Shortfall, overShare }) {
  if (!agg?.mae_mw) return null;
  const over = agg.bias_mw > 0;
  return (
    <Callout icon={Lightbulb} tone="violet" title="What this means for procurement">
      <ul>
        <li>
          WINDFOR <strong>{over ? "over-forecast" : "under-forecast"}</strong> wind by{" "}
          <strong>{fmtMW(Math.abs(agg.bias_mw))} MW</strong> on average
          {overShare != null && <> and ran high in {overShare}% of intervals</>}.
        </li>
        <li>
          {over
            ? "Relying on the forecast alone would leave the desk short: it buys less thermal power than the grid needed."
            : "Relying on the forecast alone would leave the desk long: it buys more thermal power than the grid needed."}
        </li>
        {p90Shortfall != null && p90Shortfall > 0 && (
          <li>
            In 9 of 10 intervals wind came in no more than <strong>{fmtMW(p90Shortfall)} MW</strong> below forecast.
            That is a sensible starting size for a shortage hedge.
          </li>
        )}
        <li>
          RMSE ({fmtMW(agg.rmse_mw)} MW) is well above MAE ({fmtMW(agg.mae_mw)} MW), so a few large misses dominate the
          risk. Size the buffer on tail errors, not the average.
        </li>
      </ul>
    </Callout>
  );
}

export function AccuracyView({ cutoff, onCutoffChange, month, onMonthChange }) {
  const hasData = month === DATA_MONTH;
  const acc = useAccuracy(cutoff, hasData);
  const matched = useAllMatched(cutoff, hasData);
  const cutoffInfo = cutoffFor(cutoff);
  const agg = acc.data?.aggregate;
  const daily = acc.data?.daily;
  const hourly = acc.data?.hourly;

  const { overShare, p90Shortfall } = useMemo(() => {
    const rows = matched.data;
    if (!rows?.length) return {};
    const errors = rows.map((r) => r.error_mw);
    return {
      overShare: Math.round((errors.filter((e) => e > 0).length / errors.length) * 100),
      p90Shortfall: percentile(errors, 0.9),
    };
  }, [matched.data]);

  const worstDays = useMemo(
    () => [...(daily ?? [])].sort((a, b) => b.daily_mae - a.daily_mae).slice(0, 5),
    [daily]
  );

  const metrics = [
    { label: "MAE", value: fmtMW(agg?.mae_mw), unit: "MW", hint: "Typical absolute error", tone: "amber" },
    { label: "RMSE", value: fmtMW(agg?.rmse_mw), unit: "MW", hint: "Weights large misses more", tone: "rose" },
    {
      label: "Bias",
      value: agg ? `${agg.bias_mw > 0 ? "+" : ""}${fmtMW(agg.bias_mw)}` : "—",
      unit: "MW",
      hint: "+ over-forecast · − under-forecast",
      tone: "violet",
    },
    { label: "MAPE", value: agg?.mape_pct?.toFixed(1), unit: "%", hint: "Error relative to actual", tone: "sky" },
    {
      label: "Coverage",
      value: agg?.coverage_pct?.toFixed(1),
      unit: "%",
      hint: agg ? `${fmtMW(agg.n_matched)} of ${fmtMW(agg.n_actuals)} intervals` : undefined,
      tone: "teal",
    },
  ];

  return (
    <div className="page page--accuracy">
      <PageHeader
        eyebrow={`Performance review · ${formatMonth(month)}`}
        title="Forecast accuracy"
        description="Measure forecast reliability using only the information available before the selected decision cutoff."
      />

      <div className="toolbar toolbar--dock">
        <div className="field">
          <label htmlFor="accuracy-month">Data month</label>
          <div className="select-with-icon">
            <CalendarRange size={15} aria-hidden="true" />
            <select
              id="accuracy-month"
              className="select select--with-icon"
              value={month}
              onChange={(event) => onMonthChange(event.target.value)}
            >
              {MONTHS_2026.map((value) => (
                <option key={value} value={value}>{formatMonth(value)}</option>
              ))}
            </select>
          </div>
        </div>
        <CutoffControl value={cutoff} onChange={onCutoffChange} />
      </div>

      <section className="hero-panel accuracy-hero">
        <LazySignalScene mode="accuracy" />
        <div className="accuracy-hero__rings" aria-hidden="true">
          <span />
          <span />
          <span />
          <Target size={28} />
        </div>
        <div className="hero-panel__content">
          <span className="hero-panel__kicker">FORECAST RISK ENGINE</span>
          <h2>Know the miss<br /><em>before it costs.</em></h2>
          <p>Turn forecast error into a procurement signal. Every score below is calculated without hindsight.</p>
          <div className="hero-panel__meta">
            <span><i className="pulse-dot" /> LEAKAGE-FREE ANALYSIS</span>
            <span>31 DAYS / 1,488 INTERVALS</span>
            <span>ERROR = FORECAST − ACTUAL</span>
          </div>
        </div>
        <div className="accuracy-hero__signal">
          <div className="accuracy-hero__signal-head"><span>RISK POSTURE</span><strong>{agg ? (agg.bias_mw > 0 ? "SHORTAGE WATCH" : "EXCESS WATCH") : "CALIBRATING"}</strong></div>
          <div className="risk-meter"><span style={{ width: `${agg ? Math.min(92, Math.max(18, Math.abs(agg.bias_mw) / 10)) : 42}%` }} /></div>
          <div className="accuracy-hero__grid">
            <div><span>MAE</span><strong>{agg ? `${fmtMW(agg.mae_mw)} MW` : "—"}</strong></div>
            <div><span>BIAS</span><strong>{agg ? `${agg.bias_mw > 0 ? "+" : ""}${fmtMW(agg.bias_mw)} MW` : "—"}</strong></div>
            <div><span>COVERAGE</span><strong>{agg ? `${agg.coverage_pct.toFixed(1)}%` : "—"}</strong></div>
          </div>
          <span className="accuracy-hero__signal-status"><Activity size={13} /> {hasData ? "SIGNAL QUALITY: VERIFIED" : "AWAITING DATASET"}</span>
        </div>
        <div className="accuracy-hero__badge"><ShieldAlert size={14} /> PROCUREMENT INTELLIGENCE</div>
      </section>

      {hasData && (acc.slow || matched.slow) && <SlowNotice />}
      {hasData && (acc.error || matched.error) && (
        <ErrorBanner
          message={acc.error || matched.error}
          onRetry={() => {
            acc.retry();
            matched.retry();
          }}
        />
      )}

      {!hasData ? (
        <Card className="unavailable-card accuracy-unavailable">
          <UnavailableState month={formatMonth(month)} height={280} />
        </Card>
      ) : (
      <>
      <SectionTitle index="01" title="Signal quality" subtitle="All matched 30-minute intervals · error = forecast − actual" />
      <div className="metrics metrics--5">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} loading={acc.loading} />
        ))}
      </div>

      <Insights agg={agg} p90Shortfall={p90Shortfall} overShare={overShare} />

      <SectionTitle index="02" title="Error anatomy" subtitle="Find the shape, timing, and consequence of forecast misses." />
      <Card
        title="Daily MAE and bias"
        subtitle="Bars show absolute error per day; the line shows signed bias (above zero = over-forecast)."
      >
        <ChartBoundary>
          <DailyMAEChart data={daily} loading={acc.loading} />
        </ChartBoundary>
      </Card>

      <div className="grid-2 chart-grid">
        <Card title="Forecast vs actual" subtitle="Each dot is one interval. Dots above the dashed line were over-forecast.">
          <ChartBoundary>
            <CalibrationChart data={matched.data} loading={matched.loading} />
          </ChartBoundary>
        </Card>
        <Card
          title="Error distribution"
          subtitle="Red: over-forecast, shortage risk. Blue: under-forecast, excess cost."
        >
          <ChartBoundary>
            <ErrorHistogram data={matched.data} loading={matched.loading} />
          </ChartBoundary>
        </Card>
      </div>

      <Card className="chart-card" title="Error by hour of day" subtitle="Intra-day pattern in the error, useful for shaping the hedge by delivery hour (UTC).">
        <ChartBoundary>
          <HourlyErrorChart data={hourly} loading={acc.loading} />
        </ChartBoundary>
      </Card>

      <SectionTitle index="03" title="Decision notes" subtitle="The practical takeaways behind the numbers." />
      <div className="grid-2 decision-grid">
        <Card title="Worst days" subtitle="Days where the day-ahead forecast missed by the most.">
          {acc.loading ? (
            <LoadingSkeleton height={160} />
          ) : worstDays.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" className="num">MAE</th>
                  <th scope="col" className="num">Bias</th>
                </tr>
              </thead>
              <tbody>
                {worstDays.map((d) => (
                  <tr key={d.delivery_date}>
                    <th scope="row">{formatDayShort(d.delivery_date)}</th>
                    <td className="num">{fmtMW(d.daily_mae)} MW</td>
                    <td className={`num ${d.daily_bias > 0 ? "text-rose" : "text-sky"}`}>
                      {d.daily_bias > 0 ? "+" : ""}
                      {fmtMW(d.daily_bias)} MW
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState height={140}>No daily data available</EmptyState>
          )}
        </Card>

        <Card title="Methodology" subtitle="Why these numbers are leakage-free.">
          <p className="prose">
            Each 30-minute interval joins FUELHH actual wind output with the latest WINDFOR forecast published strictly
            before {cutoffInfo.short.replace("on D-1", "on the day before delivery").replace("on D", "on the delivery day")}. Hourly forecasts are carried forward to the following half hour.
            Error is forecast minus actual. Intervals with no valid pre-cutoff forecast are excluded.
          </p>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}

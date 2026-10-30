import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Info, Wind } from "lucide-react";
import { useMatchedData } from "../hooks/useWindData";
import { DATA_MONTH, JANUARY_DAYS, MONTHS_2026, formatDayLong, formatDayShort, formatMonth, formatStamp, shiftDay } from "../lib/time";
import { fmtMW } from "../lib/stats";
import { ForecastChart } from "./Charts";
import { WindField } from "./WindField";
import { LazySignalScene } from "./LazySignalScene";
import { CutoffControl } from "./CutoffControl";
import { cutoffFor } from "../lib/cutoff";
import { Badge, Callout, SlowNotice, Card, ChartBoundary, ErrorBanner, MetricCard, PageHeader, SectionTitle, UnavailableState } from "./UI";

export function ForecastView({ cutoff, onCutoffChange, month, onMonthChange }) {
  const [date, setDate] = useState("2026-01-15");
  const hasData = month === DATA_MONTH;
  const { data, vintages, loading, error, slow, retry } = useMatchedData(date, cutoff, hasData);
  const cutoffInfo = cutoffFor(cutoff);

  const summary = useMemo(() => {
    if (!data.length) return null;
    const actuals = data.map((d) => d.actual_mw);
    const forecasts = data.map((d) => d.forecast_mw);
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    return {
      peakActual: Math.max(...actuals),
      avgActual: sum(actuals) / actuals.length,
      peakForecast: Math.max(...forecasts),
      mae: sum(data.map((d) => Math.abs(d.error_mw))) / data.length,
    };
  }, [data]);

  const vintage = vintages?.decision_vintage;
  const metrics = [
    { label: "Peak actual", value: summary?.peakActual, hint: "Highest 30-min output", tone: "teal" },
    { label: "Average actual", value: summary?.avgActual, hint: "Mean output over the day", tone: "sky" },
    { label: "Peak forecast", value: summary?.peakForecast, hint: "Highest value in the decision vintage", tone: "amber" },
    { label: "Day MAE", value: summary?.mae, hint: "Mean absolute forecast error", tone: "rose" },
  ];

  return (
    <div className="page page--forecast">
      <PageHeader
        eyebrow={`Decision support · ${formatMonth(month)}`}
        title="Wind generation forecast"
        description="The latest forecast the desk could see at decision time, compared with what the wind fleet actually generated."
      />

      <section className="hero-panel">
        <WindField />
        <LazySignalScene mode="forecast" />
        <span className="hero-panel__index">01 <i /> 02</span>
        <span className="hero-panel__stamp">NATIONAL SYSTEM / GB-WIND / {month.replace("-", ".")}</span>
        <div className="hero-panel__content">
          <span className="hero-panel__kicker">NATIONAL WIND SIGNAL</span>
          <h2>Read the air<br /><em>before the market moves.</em></h2>
          <p>One decision-grade view of the forecast vintage, the actual output, and the risk between them.</p>
          <div className="hero-panel__meta">
            <span><i className="pulse-dot" /> {formatMonth(month).toUpperCase()} REPLAY</span>
            <span>30-MIN SETTLEMENTS</span>
            <span>UTC / GB</span>
          </div>
        </div>
        <div className="hero-panel__orbit" aria-hidden="true">
          <span className="orbit orbit--one" />
          <span className="orbit orbit--two" />
          <span className="orbit__core"><Wind size={22} /></span>
        </div>
        <div className="hero-panel__readout">
          <span className="readout__label">DECISION WINDOW</span>
          <strong>{cutoffInfo.short}</strong>
          <span className="readout__line" />
          <span className="readout__label">LATEST VINTAGE</span>
          <strong>{vintage ? formatStamp(vintage) : "Awaiting signal"}</strong>
          <span className="readout__status">PRE-CUTOFF VERIFIED</span>
        </div>
      </section>

      <div className="toolbar toolbar--dock">
        <div className="field">
          <label htmlFor="data-month">Data month</label>
          <select
            id="data-month"
            className="select"
            value={month}
            onChange={(event) => {
              const nextMonth = event.target.value;
              onMonthChange(nextMonth);
              if (nextMonth === DATA_MONTH) setDate("2026-01-15");
            }}
          >
            {MONTHS_2026.map((value) => (
              <option key={value} value={value}>{formatMonth(value)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="delivery-date">Delivery date</label>
          <div className="stepper">
            <button
              className="btn btn--icon"
              aria-label="Previous day"
              disabled={!hasData || date === JANUARY_DAYS[0]}
              onClick={() => setDate(shiftDay(date, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <select id="delivery-date" className="select" value={date} onChange={(e) => setDate(e.target.value)} disabled={!hasData}>
              {JANUARY_DAYS.map((d) => (
                <option key={d} value={d}>
                  {formatDayLong(d)}
                </option>
              ))}
            </select>
            <button
              className="btn btn--icon"
              aria-label="Next day"
              disabled={!hasData || date === JANUARY_DAYS.at(-1)}
              onClick={() => setDate(shiftDay(date, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <CutoffControl value={cutoff} onChange={onCutoffChange} />

        {vintage && (
          <div className="vintage" title={`Cutoff: ${cutoffInfo.short.replace("D-1", "the day before").replace("on D", `on ${formatDayShort(date)}`)}`}>
            <Clock size={14} aria-hidden="true" />
            <span>
              Forecast published <strong>{formatStamp(vintage)} UTC</strong>
            </span>
            <Badge tone="teal">Before cutoff</Badge>
          </div>
        )}
      </div>

      {slow && <SlowNotice />}
      {error && <ErrorBanner message={error} onRetry={retry} />}

      {!hasData ? (
        <Card className="unavailable-card">
          <UnavailableState month={formatMonth(month)} height={220} />
        </Card>
      ) : (
      <>
      <SectionTitle index="01" title="Day-ahead signal" subtitle="The decision vintage translated into a clear operating picture." />
      <div className="metrics metrics--4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} value={fmtMW(m.value)} unit="MW" loading={loading} />
        ))}
      </div>

      <Card
        className="chart-card chart-card--hero"
        title="Forecast vs actual"
        subtitle={`${formatDayLong(date)} · 30-minute intervals · times in UTC`}
      >
        <ChartBoundary>
          <ForecastChart data={data} loading={loading} />
        </ChartBoundary>
      </Card>

      <Callout icon={Info} title="How the forecast is chosen">
        <p>
          For delivery day D the cutoff is {cutoffInfo.short}. We use the latest WINDFOR vintage published strictly
          before it, so nothing the desk couldn’t have known leaks into the comparison. Switch the cutoff above to see
          how much later forecasts flatter the numbers.
        </p>
      </Callout>
      </>
      )}
    </div>
  );
}

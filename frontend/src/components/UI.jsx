import { Component } from "react";
import { AlertTriangle, CalendarOff, RotateCw } from "lucide-react";

export function PageHeader({ eyebrow, title, description, children }) {
  return (
    <div className="page-header">
      {eyebrow && <span className="page-header__eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function Card({ title, subtitle, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || subtitle) && (
        <header className="card__head">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function SectionTitle({ index, title, subtitle }) {
  return (
    <div className="section-title">
      <div className="section-title__row">
        {index && <span className="section-title__index">{index}</span>}
        <h2>{title}</h2>
      </div>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

// tone: teal | amber | rose | sky | violet — a single accent bar, not a tinted box.
export function MetricCard({ label, value, unit, hint, tone = "teal", loading }) {
  return (
    <div className={`metric metric--${tone}`}>
      <span className="metric__label">{label}</span>
      {loading ? (
        <span className="skeleton skeleton--value" aria-hidden="true" />
      ) : (
        <span className="metric__value">
          {value ?? "—"}
          {unit && <span className="metric__unit">{unit}</span>}
        </span>
      )}
      {hint && <span className="metric__hint">{hint}</span>}
    </div>
  );
}

export function Badge({ children, tone = "teal" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Callout({ icon: Icon, title, children, tone = "sky" }) {
  return (
    <aside className={`callout callout--${tone}`}>
      {Icon && <Icon size={16} aria-hidden="true" className="callout__icon" />}
      <div>
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </aside>
  );
}

export function LoadingSkeleton({ height = 200, label = "Loading…" }) {
  return (
    <div className="skeleton" style={{ height }} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SlowNotice() {
  return (
    <div className="notice" role="status">
      <RotateCw size={14} className="spin" aria-hidden="true" />
      Waking up the data server and loading the selected month from Elexon. The first load can take up to a minute.
    </div>
  );
}

export function EmptyState({ height = 240, children }) {
  return (
    <div className="empty" style={{ minHeight: height }}>
      {children}
    </div>
  );
}

export function UnavailableState({ month, height = 240 }) {
  return (
    <div className="empty unavailable" style={{ minHeight: height }}>
      <CalendarOff size={24} aria-hidden="true" />
      <strong>Data not available for {month}</strong>
      <span>This dashboard currently contains January 2026 only.</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="error" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn--ghost" onClick={onRetry}>
          <RotateCw size={13} aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}

export class ChartBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    return this.state.error ? (
      <ErrorBanner message={`Chart failed to render: ${this.state.error.message}`} />
    ) : (
      this.props.children
    );
  }
}

import React from "react";
import { Wind, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

export function MetricCard({ label, value, unit, subtitle, trend, color = "teal" }) {
  const colors = {
    teal: { bg: "rgba(20,184,166,0.12)", border: "rgba(20,184,166,0.35)", text: "#14b8a6" },
    amber: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", text: "#f59e0b" },
    rose: { bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.35)", text: "#f43f5e" },
    sky: { bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.35)", text: "#0ea5e9" },
    violet: { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.35)", text: "#8b5cf6" },
  };
  const c = colors[color] || colors.teal;

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 16,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "transform 0.2s, box-shadow 0.2s",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 32px ${c.border}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: c.text, lineHeight: 1 }}>
          {value ?? "—"}
        </span>
        {unit && (
          <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>{unit}</span>
        )}
      </div>
      {subtitle && (
        <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{subtitle}</span>
      )}
    </div>
  );
}

export function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}>{title}</h2>
      {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{subtitle}</p>}
    </div>
  );
}

export function LoadingSkeleton({ height = 200, label = "Loading..." }) {
  return (
    <div
      style={{
        height,
        borderRadius: 12,
        background: "linear-gradient(90deg, rgba(30,41,59,0.8) 25%, rgba(51,65,85,0.5) 50%, rgba(30,41,59,0.8) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#475569",
        fontSize: 13,
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
      {label}
    </div>
  );
}

export function ErrorBanner({ message }) {
  return (
    <div
      style={{
        background: "rgba(244,63,94,0.1)",
        border: "1px solid rgba(244,63,94,0.3)",
        borderRadius: 10,
        padding: "12px 16px",
        color: "#fb7185",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      ⚠ {message}
    </div>
  );
}

export function Tag({ label, color = "#0ea5e9" }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `${color}22`,
        border: `1px solid ${color}44`,
        borderRadius: 6,
        padding: "2px 8px",
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </span>
  );
}

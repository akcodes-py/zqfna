import React, { useState } from "react";
import { Wind, Zap, BarChart3 } from "lucide-react";

const NAV_TABS = [
  { id: "forecast", label: "Forecast View", icon: Wind },
  { id: "accuracy", label: "Accuracy Analysis", icon: BarChart3 },
];

export function Header({ activeTab, onTabChange }) {
  return (
    <header
      style={{
        background: "rgba(10,15,30,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(71,85,105,0.3)",
        padding: "0 32px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 32,
        height: 64,
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px rgba(20,184,166,0.4)",
          }}
        >
          <Zap size={18} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>
            WindScope
          </div>
          <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            UK Wind Power Analytics
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ display: "flex", gap: 4, flex: 1 }}>
        {NAV_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            onClick={() => onTabChange(id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === id ? 600 : 400,
              color: activeTab === id ? "#14b8a6" : "#94a3b8",
              background: activeTab === id ? "rgba(20,184,166,0.12)" : "transparent",
              transition: "all 0.15s",
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {/* Badge */}
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          background: "rgba(30,41,59,0.6)",
          border: "1px solid rgba(71,85,105,0.3)",
          borderRadius: 6,
          padding: "4px 10px",
          flexShrink: 0,
        }}
      >
        January 2026 · Elexon BMRS
      </div>
    </header>
  );
}

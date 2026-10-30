import { BarChart3, CircleDot, Moon, Sun, Wind, Zap } from "lucide-react";
import { formatMonth } from "../lib/time";

const TABS = [
  { id: "forecast", label: "Forecast", icon: Wind },
  { id: "accuracy", label: "Accuracy", icon: BarChart3 },
];

export function Header({ activeTab, onTabChange, month, theme, onThemeChange }) {
  const onKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = TABS.findIndex((t) => t.id === activeTab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    onTabChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <header className="header">
      <div className="header__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <Zap size={16} />
          </span>
          <span className="brand__text">
            <span className="brand__name">WindScope</span>
            <span className="brand__tag">UK wind analytics</span>
          </span>
        </div>

        <nav className="tabs" role="tablist" aria-label="Views" onKeyDown={onKeyDown}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              aria-selected={activeTab === id}
              tabIndex={activeTab === id ? 0 : -1}
              className="tab"
              onClick={() => onTabChange(id)}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <div className="header__context">
          <span className="status">
            <CircleDot size={11} aria-hidden="true" />
            {formatMonth(month)} dataset
          </span>
          <button
            className="theme-toggle"
            type="button"
            onClick={onThemeChange}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

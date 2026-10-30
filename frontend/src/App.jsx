import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ForecastView } from "./components/ForecastView";
import { AccuracyView } from "./components/AccuracyView";
import { DATA_MONTH } from "./lib/time";

const TAB_IDS = ["forecast", "accuracy"];
const fromHash = () => (TAB_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "forecast");

export default function App() {
  const [tab, setTab] = useState(fromHash);
  const [cutoff, setCutoff] = useState(13);
  const [month, setMonth] = useState(DATA_MONTH);
  const [theme, setTheme] = useState(() => localStorage.getItem("windscope-theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("windscope-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const change = (id) => {
    location.hash = id;
    setTab(id);
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header
        activeTab={tab}
        onTabChange={change}
        month={month}
        theme={theme}
        onThemeChange={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      />
      <main id="main" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "forecast" ? (
          <ForecastView cutoff={cutoff} onCutoffChange={setCutoff} month={month} onMonthChange={setMonth} />
        ) : (
          <AccuracyView cutoff={cutoff} onCutoffChange={setCutoff} month={month} onMonthChange={setMonth} />
        )}
      </main>
      <Footer />
    </>
  );
}

import { useState } from "react";
import { Header } from "./components/Header";
import { ForecastView } from "./components/ForecastView";
import { AccuracyView } from "./components/AccuracyView";

function App() {
  const [activeTab, setActiveTab] = useState("forecast");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050c1a",
        backgroundImage:
          "radial-gradient(ellipse at 20% 50%, rgba(20,184,166,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(14,165,233,0.06) 0%, transparent 60%)",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: "#e2e8f0",
      }}
    >
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main>
        {activeTab === "forecast" && <ForecastView />}
        {activeTab === "accuracy" && <AccuracyView />}
      </main>
    </div>
  );
}

export default App;

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 90_000;

async function get(path, params) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}${query}`, { signal: controller.signal });
    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        detail = body.detail || "";
      } catch {
        // Keep the status message when the server does not return JSON.
      }
      throw new Error(detail || `Request failed (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The data server took too long to respond. Please retry.");
    }
    if (error instanceof TypeError) {
      throw new Error("Could not reach the data server. Check your connection and retry.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const p = (offset, extra = {}) => ({ cutoff_offset_hours: String(offset), ...extra });

export const api = {
  getMatched: (offset, date) => get("/api/matched", p(offset, date ? { delivery_date: date } : {})),
  getAccuracy: (offset) => get("/api/accuracy", p(offset)),
  getDailyAccuracy: (offset) => get("/api/accuracy/daily", p(offset)),
  getHourlyAccuracy: (offset) => get("/api/accuracy/hourly", p(offset)),
  getForecastVintages: (offset, date) => get("/api/forecast-vintages", p(offset, { delivery_date: date })),
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  getActuals: () => request("/api/actuals"),
  getForecasts: (deliveryDate) =>
    request(deliveryDate ? `/api/forecasts?delivery_date=${deliveryDate}` : "/api/forecasts"),
  getMatched: (deliveryDate) =>
    request(deliveryDate ? `/api/matched?delivery_date=${deliveryDate}` : "/api/matched"),
  getAccuracy: () => request("/api/accuracy"),
  getDailyAccuracy: () => request("/api/accuracy/daily"),
  getHourlyAccuracy: () => request("/api/accuracy/hourly"),
  getForecastVintages: (deliveryDate) =>
    request(`/api/forecast-vintages?delivery_date=${deliveryDate}`),
  health: () => request("/health"),
};

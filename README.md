# UK Wind Power Forecast Dashboard

A full-stack web application for a UK electricity utility's day-ahead procurement team to:
1. **Understand the latest wind generation forecasts** available at decision time
2. **Quantify forecast accuracy** to make informed procurement decisions

> **AI Disclosure:** This application was built with AI assistance (Google Antigravity / Gemini). All data pipeline logic, anti-leakage rules, and accuracy metric definitions were carefully designed and reviewed by the developer.

---

## Live Demo

- **Frontend (Vercel):** _[Add deployed URL here]_
- **Backend API (Render/Railway):** _[Add deployed backend URL here]_

---

## Project Structure

```
Grid/
├── docker-compose.yml          # Orchestrates backend + frontend containers
├── README.md                   # This file
│
├── backend/
│   ├── main.py                 # FastAPI app — 7 REST endpoints
│   ├── elexon_client.py        # Async Elexon BMRS API client
│   ├── data_processor.py       # Anti-leakage pipeline + accuracy metrics
│   ├── cache.py                # In-memory TTL cache for historical data
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Python 3.11 slim container
│   └── tests/
│       └── test_data_processor.py  # 16 Pytest unit tests
│
└── frontend/
    ├── src/
    │   ├── App.jsx                      # Root component — tab management
    │   ├── api/client.js                # API fetch wrapper
    │   ├── hooks/useWindData.js         # React hooks for data fetching
    │   └── components/
    │       ├── Header.jsx               # Sticky nav header
    │       ├── ForecastView.jsx         # Forecast tab — date picker + chart
    │       ├── AccuracyView.jsx         # Accuracy tab — metrics + charts
    │       ├── Charts.jsx               # Recharts visualisations
    │       └── UI.jsx                   # Shared metric cards, skeletons, etc.
    ├── Dockerfile                       # Multi-stage Node build + Nginx
    ├── nginx.conf                       # Nginx config with API proxy + SPA fallback
    ├── vite.config.js                   # Vite dev server + proxy config
    └── package.json
```

---

## How to Run

### Option 1: Docker Compose (Recommended)

```bash
# Start the full stack (backend on :8000, frontend on :3000)
docker-compose up --build

# Open http://localhost:3000
```

On first startup the backend pre-warms its cache by fetching January 2026 data from Elexon (~10–20 seconds). All subsequent requests are served from memory.

### Option 2: Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# API available at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:5173
# (Vite proxies /api/* → localhost:8000)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/actuals` | Actual WIND generation — Jan 2026, 30-min intervals |
| `GET` | `/api/forecasts` | All WINDFOR forecast records |
| `GET` | `/api/matched` | Actuals joined to best pre-cutoff forecast per interval |
| `GET` | `/api/accuracy` | Aggregate MAE, RMSE, MAPE, Bias for January 2026 |
| `GET` | `/api/accuracy/daily` | Daily MAE and bias |
| `GET` | `/api/accuracy/hourly` | Error profile by hour-of-day |
| `GET` | `/api/forecast-vintages` | All forecast publish times for a delivery date |

Interactive API docs: `http://localhost:8000/docs`

---

## Key Design Decisions

### Anti-Leakage Forecast Selection

For delivery day **D**, the procurement team must commit to purchases by the day-ahead market gate closure (~11:00 UTC on D-1). We conservatively use **midnight UTC at the start of day D** as the decision cutoff:

```
cutoff = midnight(D) in UTC
selected forecast = latest WINDFOR vintage with publishTime < cutoff
```

This ensures no forecast published after the decision point is used in accuracy evaluation — preventing data leakage that would make accuracy look artificially better than real-world performance.

### FUELHH API Quirk

The Elexon BMRS `FUELHH /stream` endpoint ignores `from`/`to` date parameters and returns only the most recent real-time data. Historical data is retrieved by passing individual `settlementDate` values, one day at a time (31 concurrent async requests for January 2026).

### Accuracy Metrics

| Metric | MW Interpretation for Procurement |
|--------|-----------------------------------|
| **MAE** | Typical absolute forecast error — minimum additional backup capacity to hedge |
| **RMSE** | Penalises large errors — important for tail-risk sizing |
| **Bias** | Signed mean error — positive = system over-forecasts wind (excess purchases); negative = under-forecasts (shortage risk) |
| **MAPE** | Scale-free % error for stakeholder communication |

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

All 16 tests cover:
- Anti-leakage boundary conditions (exact cutoff exclusion)
- Correct forecast matching across multiple delivery dates
- MAE, RMSE, and Bias calculation on known synthetic data
- Edge cases: empty datasets, missing forecasts

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18 + Vite |
| Charts | Recharts |
| Backend API | FastAPI + Uvicorn |
| Data pipeline | Pandas + NumPy |
| HTTP client | httpx (async) |
| Testing | Pytest |
| Containerisation | Docker + Docker Compose |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Data Sources

All data sourced from the [Elexon BMRS Insights API](https://bmrs.elexon.co.uk/api-documentation) (public, no authentication required):

- **Actuals:** `FUELHH` dataset — `fuelType=WIND`, `settlementDate` per day
- **Forecasts:** `WINDFOR` dataset — filtered by `publishDateTimeFrom`/`publishDateTimeTo`


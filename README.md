# UK Wind Power Forecast Dashboard

A full-stack web application for a UK electricity utility's day-ahead procurement team to:
1. **Understand the latest wind generation forecasts** available at decision time
2. **Quantify forecast accuracy** to make informed procurement decisions

> **AI Disclosure:** This application was built with AI assistance (Claude and Cursor). All data pipeline logic, anti-leakage rules, and accuracy metric definitions were carefully designed and reviewed by the developer.

---

## Live Demo

- **Frontend (Vercel):** _[Add deployed URL here before submitting]_
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
│       └── test_data_processor.py  # 20 Pytest tests
│
└── frontend/
    ├── src/
    │   ├── App.jsx                      # Root component — tab management
    │   ├── api/client.js                # API fetch wrapper
    │   ├── hooks/useWindData.js         # React hooks for data fetching
    │   ├── lib/                         # time.js (UTC formatting), stats.js, cutoff.js
    │   └── components/
    │       ├── Header.jsx               # Sticky nav + accessible tabs
    │       ├── CutoffControl.jsx        # Decision-cutoff switch
    │       ├── Footer.jsx
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

All `/api/matched`, `/api/accuracy*` and `/api/forecast-vintages` endpoints accept `cutoff_offset_hours` (`0` or `13`, default `0`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/actuals` | Actual WIND generation — Jan 2026, 30-min intervals |
| `GET` | `/api/forecasts` | All WINDFOR forecast records |
| `GET` | `/api/matched` | Actuals joined to best pre-cutoff forecast per interval |
| `GET` | `/api/accuracy` | Aggregate MAE, RMSE, MAPE, Bias and coverage for January 2026 |
| `GET` | `/api/accuracy/daily` | Daily MAE and bias |
| `GET` | `/api/accuracy/hourly` | Error profile by hour-of-day |
| `GET` | `/api/forecast-vintages` | All forecast publish times for a delivery date |

Interactive API docs: `http://localhost:8000/docs`

---

## Key Design Decisions

### Anti-Leakage Forecast Selection

For delivery day **D**, the desk must commit at the day-ahead auction gate closure (about 11:00 UTC on D-1). The decision cutoff is switchable in the UI and via `cutoff_offset_hours` on the API:

| Cutoff | `cutoff_offset_hours` | Rule |
|--------|----------------------|------|
| Gate closure (default in UI) | `13` | latest WINDFOR vintage with `publishTime < 11:00 UTC on D-1` |
| Midnight | `0` | latest WINDFOR vintage with `publishTime < 00:00 UTC on D` |

Midnight admits forecasts published up to 13 hours after the auction closed, so its accuracy numbers are slightly optimistic. Gate closure is the stricter and more realistic choice.

WINDFOR publishes hourly forecasts while FUELHH actuals are half-hourly. Each hourly forecast is carried forward to the following `:30` interval, so every settlement period is evaluated.

### FUELHH API Note

FUELHH accepts at most 7 days per request, so January 2026 is fetched in concurrent 7-day chunks and de-duplicated by `startTime`. WINDFOR is fetched once via `publishDateTimeFrom`/`publishDateTimeTo`.

### Accuracy Metrics

| Metric | MW Interpretation for Procurement |
|--------|-----------------------------------|
| **MAE** | Typical absolute forecast error — minimum additional backup capacity to hedge |
| **RMSE** | Penalises large errors — important for tail-risk sizing |
| **Bias** | Signed mean error — positive = wind over-forecast, so the desk under-buys thermal power (shortage risk); negative = wind under-forecast, so it over-buys (excess cost) |
| **MAPE** | Scale-free % error for stakeholder communication |
| **Coverage** | % of 30-min intervals with a valid pre-cutoff forecast |

---

## Deployment

| Where | Setting |
|-------|---------|
| Render (backend) | root `backend`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`; optional `CORS_ORIGINS=https://<your-vercel-app>` |
| Vercel (frontend) | root `frontend`, env `VITE_API_URL=https://<your-render-app>` (no trailing slash); `vercel.json` handles SPA routing |

The backend warms its cache in the background at startup, so `/health` answers immediately. Free Render instances sleep when idle; the UI shows a notice while the first request wakes the server.

## Frontend Notes

- All timestamps are rendered in **UTC** (`src/lib/time.js`), never the browser's local timezone.
- Styling uses CSS design tokens in `src/index.css`; no inline style objects.
- Tabs follow the WAI-ARIA tabs pattern (arrow keys, hash-synced view).

## Author

[Akcodes-py](https://github.com/Akcodes-py)

## Running Tests

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

All 20 tests cover:
- Anti-leakage boundary conditions (exact cutoff exclusion)
- Correct forecast matching across multiple delivery dates
- MAE, RMSE, and Bias calculation on known synthetic data
- Configurable cutoff (midnight vs gate closure)
- Concurrent cold requests share a single Elexon fetch
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


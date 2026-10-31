# WindScope

WindScope is a full-stack decision-support dashboard for a UK electricity
procurement team. It replays January 2026 Elexon BMRS wind data to answer two
practical questions:

1. What wind forecast was available before the procurement decision?
2. How accurate was that forecast, and what risk did the error create?

The application compares `FUELHH` half-hourly actual generation with `WINDFOR`
forecast vintages, applies an explicit decision cutoff, and presents the
resulting forecast error in procurement terms.

> **AI Disclosure:** This application was built with AI assistance (Claude and Cursor). All data pipeline logic, anti-leakage rules, and accuracy metric definitions were carefully designed and reviewed by the developer.

---

## Links

- **Frontend (Vercel):** _Pending deployment — replace this line with the public URL_
- **Backend API (Render):** _Pending deployment — replace this line with the public URL_
- **API health check:** `<backend-url>/health`

Replace the pending entries only after the deployments have been tested in an
incognito window. The repository should never contain invented or unverified
links.

## Engineering highlights

- **Leakage-free evaluation:** forecast selection uses the strict rule
  `publish_time < cutoff`.
- **Two decision policies:** gate closure at 11:00 UTC on D-1 and midnight on
  delivery day D.
- **Temporal alignment:** `pandas.merge_asof` aligns hourly WINDFOR forecasts
  with half-hourly FUELHH settlement intervals.
- **Procurement risk metrics:** MAE, RMSE, bias, MAPE, coverage, daily/hourly
  error profiles, and P90 positive forecast misses for shortage-risk sizing.
- **Resilient experience:** loading, slow-server, error, retry, unavailable
  month, responsive, accessible, and light/dark theme states.
- **Verified quality:** 26 backend tests plus frontend lint and production
  build validation.

---

## Project Structure

```
Grid/
├── docker-compose.yml          # Orchestrates backend + frontend containers
├── README.md                   # This file
│
├── backend/
│   ├── main.py                 # FastAPI app — 8 REST endpoints
│   ├── elexon_client.py        # Async Elexon BMRS API client
│   ├── data_processor.py       # Anti-leakage pipeline + accuracy metrics
│   ├── cache.py                # In-memory TTL cache for historical data
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Python 3.11 slim container
│   └── tests/
│       ├── test_data_processor.py  # Pipeline, matching, metric, cache tests
│       └── test_api_validation.py  # API boundary validation tests
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

### Procurement buffer guidance

The Accuracy view separates a typical-error baseline from tail-risk guidance:

- **MAE** is the average absolute error and is a useful baseline for a routine
  hedge, not a guaranteed reserve requirement.
- **P90 shortfall** is the 90th percentile of positive forecast errors
  (`forecast - actual` when wind is lower than forecast). It is the more
  conservative reference for shortage-risk sizing.

Neither value is an automated trading instruction. A procurement team should
combine the displayed error distribution with its risk appetite, imbalance
costs, and other generation positions before placing a hedge.

---

## Deployment

| Where | Setting |
|-------|---------|
| Render (backend) | root `backend`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`; optional `CORS_ORIGINS=https://<your-vercel-app>` |
| Vercel (frontend) | root `frontend`, env `VITE_API_URL=https://<your-render-app>` (no trailing slash); `vercel.json` handles SPA routing |

The backend warms its cache in the background at startup, so `/health` answers immediately. Free Render instances sleep when idle; the UI shows a notice while the first request wakes the server.

### Deployment verification

1. Connect the repository containing `render.yaml` to Render. If the GitHub
   repository root is this project directory, keep **Root Directory** as
   `backend`. If the repository contains this project inside a parent `Grid`
   folder, use `Grid/backend` instead.
2. Use the configuration in `render.yaml`, or set these values manually:
   build command `pip install -r requirements.txt`, start command
   `uvicorn main:app --host 0.0.0.0 --port $PORT`, and health check path
   `/health`.
3. Set `CORS_ORIGINS` on Render to the exact Vercel origin, without a trailing
   slash.
4. Deploy the frontend from the `frontend` root with `VITE_API_URL` set to the
   Render origin, without a trailing slash.
5. Verify `/health`, `/api/accuracy?cutoff_offset_hours=13`, and
   `/api/matched?cutoff_offset_hours=13`.
6. In the deployed UI, test both cutoff options, Forecast and Accuracy tabs,
   light/dark mode, and a mobile viewport.

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

The test suite covers:
- Anti-leakage boundary conditions (exact cutoff exclusion)
- Correct forecast matching across multiple delivery dates
- MAE, RMSE, and Bias calculation on known synthetic data
- Configurable cutoff (midnight vs gate closure)
- Concurrent cold requests share a single Elexon fetch
- Edge cases: empty datasets, missing forecasts
- API cutoff and delivery-date validation

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19 + Vite |
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

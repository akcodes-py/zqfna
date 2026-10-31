# WindScope demo video script

**Target length:** 6.5–7.5 minutes  
**Speaking pace:** Calm and conversational, around 130 words per minute

## Before recording

- Start the backend and frontend.
- Open `http://127.0.0.1:5173`.
- Load January 2026, January 15, with **Gate closure** selected.
- Close unrelated tabs and hide personal information.
- Keep browser zoom at 100%.
- Read exact KPI numbers from the screen. If live values differ from the
  examples below, use the values currently displayed.

## Part 1 — Product and domain walkthrough

### 0:00–0:35 — Introduction and problem

**Show:** WindScope Forecast page loaded on January 2026, January 15, 2026,
with Gate closure selected.

**Say:**

> Hi, I’m Atul. This is WindScope, a decision-support and forecast-auditing
> dashboard built for a UK electricity procurement desk.
>
> You buy power a day ahead. Wind is weather-driven, so you buy thermal to
> cover what wind won't. The question is how far you can trust the wind
> forecast.
>
> When a procurement team commits positions ahead of delivery, it cannot use
> hindsight. It can only use the forecast vintage published before the market
> decision cutoff.
>
> WindScope replays January 2026 Elexon BMRS data across 30-minute settlement
> periods to answer three questions: what could the desk see at decision time,
> how did that compare with actual wind generation, and what procurement risk
> did the forecast error create?

### 0:35–1:35 — Forecast workflow and cutoff

**Show:**

1. Point to the January 2026 month selector.
2. Point to the January 15 delivery-date selector.
3. Point to the Gate closure control.
4. Point to the forecast vintage badge.

**Say:**

> The Forecast view focuses on one delivery day. I can step through dates and
> choose the decision boundary.
>
> Gate closure means 11:00 UTC on D minus 1. For January 15, that is 11:00 UTC
> on January 14.
>
> The badge shows the selected forecast publication time. The backend only
> accepts a forecast where `publish_time < cutoff`, so any vintage published
> at or after the cutoff is excluded. This gives a leakage-free evaluation
> under the documented cutoff and time-alignment assumptions.

### 1:35–2:25 — Day-ahead KPIs and chart

**Show:** The four Day-ahead signal cards, then hover across the chart.

**Say:**

> These cards translate the decision vintage into an operating picture. Peak
> actual and average actual describe what the wind fleet produced. Peak
> forecast shows the highest value in the selected decision vintage, and Day
> MAE shows the average absolute error for this delivery day.
>
> I can hover over the half-hourly chart to see exactly where the forecast
> diverged from actual generation. When forecast wind is higher than actual
> wind, the procurement desk may buy too little backup power and face shortage
> or imbalance risk.

**Optional, only if the values are visible:**

> For this example, the screen shows a peak forecast of [read value] MW versus
> a peak actual of [read value] MW, with a Day MAE of [read value] MW.

### 2:25–3:05 — Gate closure versus Midnight

**Show:** Click Midnight, pause for two seconds, then return to Gate closure.

**Say:**

> Now I’ll compare the two decision policies.
>
> Midnight allows forecasts published up to 00:00 UTC on the delivery day.
> Gate closure allows only information available by 11:00 UTC on the previous
> day. Midnight may look slightly more accurate because it uses later forecast
> vintages.
>
> Switching back to Gate closure restores the stricter day-ahead procurement
> view. Making this boundary visible prevents the information assumption from
> being hidden inside the backend.

### 3:05–4:15 — Accuracy and procurement risk

**Show:** Accuracy tab, metric cards, procurement callout, and diagnostic
charts.

**Say:**

> The Accuracy tab evaluates the full January 2026 dataset across matched
> 30-minute settlement intervals.
>
> MAE represents typical absolute error. RMSE gives more weight to large
> misses. Bias is signed error: because the system defines error as forecast
> minus actual, positive bias means wind was over-forecast. MAPE gives a
> percentage view, and Coverage shows how many actual intervals had a valid
> pre-cutoff forecast.
>
> The procurement callout translates those numbers into action. The P90
> shortfall is calculated only from positive forecast errors, where wind was
> over-forecast. It is a more conservative starting point for shortage-risk
> sizing than MAE.
>
> These are decision-support values, not automatic trading instructions. A
> real procurement desk would combine them with imbalance prices, portfolio
> positions, and risk appetite.

**Continue while scrolling:**

> The diagnostic charts explain the shape and timing of the errors. Daily MAE
> highlights difficult delivery days. The scatter plot checks calibration
> against the one-to-one line. The histogram shows the signed error
> distribution. The hourly profile shows whether certain times of day carry
> more risk, and the Worst Days table surfaces the five highest-MAE dates.

## Part 2 — Technical and code walkthrough

### 4:15–4:55 — System architecture

**Show:** Project tree and README.

**Say:**

> Under the hood, WindScope has a React and Vite frontend, a FastAPI and
> pandas backend, an asynchronous Elexon client, and Docker Compose for local
> orchestration. The deployment configuration is prepared for Vercel and
> Render.
>
> The frontend owns presentation, navigation, and state. The backend owns
> Elexon retrieval, cutoff enforcement, temporal matching, metrics, and API
> serialization. This keeps the procurement rules in one trusted layer rather
> than duplicating them in the browser.

### 4:55–5:40 — Elexon data integration

**Show:** `backend/elexon_client.py`.

**Say:**

> Actual wind generation comes from Elexon’s FUELHH dataset, filtered to
> WIND. Forecast vintages come from WINDFOR.
>
> FUELHH has a narrow date-range limit per request, so the client splits the
> month into seven-day windows, fetches those windows concurrently with
> `httpx.AsyncClient` and `asyncio.gather`, and deduplicates records by
> timestamp.
>
> Timestamps are normalized to UTC, malformed records are skipped with a
> warning, and the backend reuses an in-memory TTL cache. The service layer
> also uses per-key locks so concurrent cold requests share one fetch instead
> of creating a cache stampede.

### 5:40–6:25 — Leakage-free temporal matching

**Show:** `backend/data_processor.py`, focusing on cutoff filtering and
`merge_asof`.

**Say:**

> In the processing layer, hourly WINDFOR forecasts are aligned with
> half-hourly FUELHH actuals.
>
> For each delivery period, the system computes either 11:00 UTC on D minus 1
> for Gate closure or 00:00 UTC on D for Midnight. It then applies the strict
> inequality `publish_time < cutoff`, so a forecast published exactly on the
> boundary cannot enter the evaluation.
>
> The latest valid vintage is selected, and `pandas.merge_asof` performs a
> backward time-aware join for the hourly-to-half-hour alignment. The result
> contains signed error, absolute error, and the procurement metrics used by
> the UI.

### 6:25–7:00 — Tests and closing

**Show:** Integrated terminal.

**Run:**

```bash
cd backend
python -m pytest tests -v
```

**Say:**

> The suite contains 26 tests covering exact cutoff boundaries, both cutoff
> modes, hourly-to-half-hourly matching, metric calculations, P90 shortage
> logic, empty-data cases, cache-stampede locking, and FastAPI input
> validation.
>
> The frontend also passes lint and the production build.
>
> That is WindScope: an auditable wind analytics workflow connecting raw
> Elexon data to real procurement decisions. The key design choice is that
> every result is tied to a visible decision cutoff, so the user can
> distinguish a realistic forecast evaluation from a hindsight comparison.
> Thanks for watching.

## Recording checklist

- [ ] Keep the video between 6.5 and 7.5 minutes.
- [ ] Show both Forecast and Accuracy pages.
- [ ] Compare Gate closure and Midnight.
- [ ] Read exact numbers from the current screen.
- [ ] Explain the strict pre-cutoff rule.
- [ ] Explain positive bias and P90 shortage risk.
- [ ] Name FUELHH and WINDFOR.
- [ ] Show `python -m pytest tests -v` and the 26 passing tests.
- [ ] Keep credentials and unrelated tabs hidden.
- [ ] Upload as unlisted if required by the challenge.

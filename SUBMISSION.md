# Submission guide (delete this file before publishing the repo)

## 1. Pre-flight
- [ ] New repo with a random name (e.g. `kjhwr`), single fresh commit, author = Akcodes-py with your GitHub noreply email
- [ ] Not committed: challenge PDF, `.env`, `__pycache__`, `.pytest_cache`, `node_modules`
- [ ] Backend on Render: set start command from `render.yaml`; free tier sleeps, so open the URL a minute before recording
- [ ] Frontend on Vercel: root `frontend`, env var `VITE_API_URL=<render url>`
- [ ] README: fill in both live URLs
- [ ] Open every link in an incognito window
- [ ] Unlisted YouTube video, max 10 minutes

## 2. Video script (10 min)

### Part 1: client pitch (about 4:30). Speak to the procurement team.
1. **0:00 Problem.** "You buy power a day ahead. Wind is weather-driven, so you buy thermal to cover what wind won't. The question is how far you can trust the wind forecast."
2. **0:30 Forecast tab.** Pick a day, e.g. 15 Jan. Show forecast vs actual, the "published before cutoff" badge, and the four KPIs. Step with the arrow buttons to two or three days.
3. **1:45 Cutoff switch.** "We only show what you could have known at the auction deadline." Toggle Gate closure / Midnight and point out the numbers change a little.
4. **2:30 Accuracy tab.** Read the five KPIs. Key line: the forecast ran high on average (positive bias), so relying on it means buying too little backup, which is shortage risk.
5. **3:30 Insight box + worst days.** Quote the 90th-percentile shortfall as a hedge starting size. Show the hourly chart and any intra-day pattern.
6. **4:15 Close.** "Next steps: weather-regime features, per-hour hedge sizing, live data."

### Part 2: tech lead walkthrough (about 5:30)
1. **0:00 Architecture.** React + Vite + Recharts, FastAPI, pandas, Elexon BMRS, Docker, Vercel + Render. One sentence on why: small and fast.
2. **0:45 Data.** FUELHH (actuals, 7-day chunk limit) and WINDFOR (all vintages, via the stream endpoint). Show `elexon_client.py`.
3. **1:45 Core logic.** `build_matched_dataset`: cutoff = delivery-day midnight minus offset, filter `publish_time < cutoff`, keep the latest vintage, `merge_asof` to map hourly forecasts onto half-hours. Say why strict `<` and why there is no leakage.
4. **3:00 Metrics.** Error = forecast − actual, so positive means over-forecast. MAE, RMSE, bias, MAPE (actuals above 10 MW only), coverage.
5. **3:45 Frontend.** Hooks per view, UTC-only time formatting in `lib/time.js`, CSS tokens, accessible tabs, error and retry states.
6. **4:30 Quality.** 19 pytest tests (boundary at the exact cutoff, empty inputs, offset), lint, Docker compose.
7. **5:00 AI usage + limitations.** Say which AI tools you used and what you reviewed yourself. Limits: one month of data, national level only, in-memory cache, midnight vs gate-closure assumption.

## 3. Questions to be ready for
- Why is the cutoff not the exact auction time? (GB and EPEX timings differ, so it is a switchable assumption.)
- Why is coverage 100%? (Hourly forecasts are carried to the next half-hour; say so.)
- What would you do with more time? (Horizon-based error curves, quantile or P90 buffers, wind-regime splits, database instead of in-memory cache.)

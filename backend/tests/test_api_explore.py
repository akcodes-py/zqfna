import urllib.request, json

urls_to_try = [
    ("FUELHH_settleDate", "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH?settlementDate=2026-01-01&fuelType=WIND"),
    ("wind_solar", "https://data.elexon.co.uk/bmrs/api/v1/generation/actual/per-type/wind-and-solar?from=2026-01-01T00:00:00Z&to=2026-01-01T23:59:59Z"),
    ("FUELHH_stream_settle", "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream?settlementDate=2026-01-01&fuelType=WIND"),
]

for name, url in urls_to_try:
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
            items = data if isinstance(data, list) else data.get("data", [])
            print(f"{name}: {len(items)} records")
            if items:
                dates = sorted(set(i.get("startTime","")[:10] for i in items))
                print(f"  Dates: {dates}")
                print(f"  Sample startTime: {items[0].get('startTime','?')}")
    except Exception as e:
        print(f"{name}: ERROR - {e}")
    print()

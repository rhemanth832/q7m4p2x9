"""Fetch ONLY Elexon WINDFOR and FUELHH. Run: python -m backend.ingest.

Publication windows are half-open locally, even if the source API is inclusive.
Raw responses, UTC fetch times and SHA-256 hashes are retained for provenance.
An immutable normalized JSON snapshot is committed for reproducible pilot runs.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://data.elexon.co.uk/bmrs/api/v1"


def fetch(dataset: str, day: date) -> tuple[list[dict], dict]:
    next_day = day + timedelta(days=1)
    params = (
        {"publishDateTimeFrom": f"{day}T00:00:00Z", "publishDateTimeTo": f"{next_day}T00:00:00Z"}
        if dataset == "WINDFOR"
        else {"settlementDateFrom": str(day), "settlementDateTo": str(day), "fuelType": "WIND"}
    )
    url = f"{API}/datasets/{dataset}/stream?{urlencode(params)}"
    last_error = None
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={"User-Agent": "WindProcure-Pilot/1.0"}), timeout=60) as response:
                raw = response.read()
            rows = json.loads(raw)
            if not isinstance(rows, list):
                raise ValueError(f"Unexpected {dataset} response shape")
            path = ROOT / "data" / "raw" / f"{dataset}-{day}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            meta = {
                "dataset": dataset, "date": str(day), "url": url,
                "fetchedAt": datetime.now(timezone.utc).isoformat(),
                "sha256": hashlib.sha256(raw).hexdigest(), "rawRows": len(rows),
            }
            if dataset == "WINDFOR":
                rows = [r for r in rows if f"{day}T00:00:00Z" <= r["publishTime"] < f"{next_day}T00:00:00Z"]
            else:
                rows = [r for r in rows if r.get("fuelType") == "WIND" and r["startTime"][:10] == str(day)]
            return rows, meta
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(1 + attempt * 2)
    raise RuntimeError(f"Failed {dataset} {day}: {last_error}")


def run(workers: int = 5) -> None:
    # Include one preceding publication day for an early Jan 1 cutoff.
    forecast_days = [date(2025, 12, 31) + timedelta(days=i) for i in range(32)]
    actual_days = [date(2026, 1, 1) + timedelta(days=i) for i in range(32)]
    jobs = [("WINDFOR", d) for d in forecast_days] + [("FUELHH", d) for d in actual_days]
    forecasts, actuals, provenance = [], [], []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch, ds, day): (ds, day) for ds, day in jobs}
        for future in as_completed(futures):
            dataset, day = futures[future]
            rows, meta = future.result()
            (forecasts if dataset == "WINDFOR" else actuals).extend(rows)
            provenance.append(meta)
            print(f"{dataset} {day}: {len(rows)} rows", flush=True)

    # Explicitly fail on conflicting equal-publication revisions; never arbitrary last-wins.
    def normalize(rows, kind):
        unique = {}
        for row in rows:
            value = row.get("generation")
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError(f"Invalid generation in {kind}: {row}")
            key = row["startTime"], row["publishTime"]
            if key in unique and unique[key] != value:
                raise ValueError(f"Conflicting revision in {kind}: {key}")
            unique[key] = value
        return [{"startTime": s, "publishTime": p, "generation": g} for (s, p), g in sorted(unique.items())]

    snapshot = {
        "schemaVersion": 1,
        "source": "Elexon BMRS Insights",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "decisionRange": {"from": "2026-01-01", "to": "2026-01-31"},
        "deliveryRange": {"from": "2026-01-02", "to": "2026-02-01"},
        "forecasts": normalize(forecasts, "WINDFOR"),
        "actuals": normalize(actuals, "FUELHH/WIND"),
        "requests": sorted(provenance, key=lambda r: (r["dataset"], r["date"])),
    }
    output = ROOT / "data" / "elexon-january-2026.json"
    tmp = output.with_suffix(".tmp")
    tmp.write_text(json.dumps(snapshot, separators=(",", ":")) + "\n")
    tmp.replace(output)
    print(f"Saved {len(snapshot['forecasts'])} forecast revisions and {len(snapshot['actuals'])} wind actuals to {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=5, choices=range(1, 9))
    run(parser.parse_args().workers)

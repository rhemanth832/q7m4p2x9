"""Pure, deterministic analysis. MW throughout; no interpolation or demand data.

Error = forecast minus actual: positive values indicate wind shortfall exposure.
The month is a retrospective evaluation. Decision-time risk uses strictly earlier
completed deliveries and actual revisions published by that historical cutoff.
"""
from __future__ import annotations

from bisect import bisect_right
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
import hashlib
import gzip
import json
import math
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[1]
UTC = timezone.utc
FIRST = date(2026, 1, 1)
LAST = date(2026, 1, 31)


def iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def quantile(values: list[float], probability: float) -> float | None:
    """Linear interpolation between adjacent order statistics (type 7)."""
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def metrics(pairs: list[tuple[float, float]]) -> dict:
    if not pairs:
        return {"count": 0, "maeMW": None, "rmseMW": None, "biasMW": None,
                "wapePercent": None, "overforecastPercent": None, "p90AbsMW": None}
    errors = [forecast - actual for forecast, actual in pairs]
    absolute = [abs(e) for e in errors]
    actual_total = sum(actual for _, actual in pairs)
    return {
        "count": len(pairs), "maeMW": mean(absolute),
        "rmseMW": math.sqrt(mean([e * e for e in errors])), "biasMW": mean(errors),
        "wapePercent": sum(absolute) / actual_total * 100 if actual_total > 0 else None,
        "overforecastPercent": sum(e > 0 for e in errors) / len(errors) * 100,
        "p90AbsMW": quantile(absolute, 0.9),
    }


class Repository:
    def __init__(self, payload: dict):
        self.payload = payload
        self.forecasts = self._index(payload["forecasts"])
        self.actuals = self._index(payload["actuals"])

    @staticmethod
    def _index(rows: list[dict]) -> dict:
        grouped = defaultdict(list)
        for row in rows:
            grouped[row["startTime"]].append(row)
        return {target: sorted(versions, key=lambda r: r["publishTime"])
                for target, versions in grouped.items()}

    @staticmethod
    def latest(index: dict, target: str, cutoff: str | None = None) -> dict | None:
        versions = index.get(target, [])
        if not versions:
            return None
        if cutoff is None:
            return versions[-1]
        position = bisect_right(versions, cutoff, key=lambda r: r["publishTime"]) - 1
        return versions[position] if position >= 0 else None

    def base_day(self, decision_date: str, cutoff: str, actual_cutoff: str | None = None) -> dict:
        decision = date.fromisoformat(decision_date)
        if not FIRST <= decision <= LAST:
            raise ValueError("Decision date must be between 2026-01-01 and 2026-01-31.")
        parsed_time = time.fromisoformat(cutoff)
        if len(cutoff) != 5 or parsed_time.tzinfo is not None:
            raise ValueError("Cutoff must use HH:MM in Europe/London (GMT in January).")
        as_of = iso(datetime.combine(decision, parsed_time, UTC))
        delivery = decision + timedelta(days=1)
        midnight = datetime.combine(delivery, time(), UTC)
        rows = []
        for period in range(48):
            target = iso(midnight + timedelta(minutes=30 * period))
            forecast = self.latest(self.forecasts, target, as_of)
            actual = self.latest(self.actuals, target, actual_cutoff)
            f = forecast["generation"] if forecast else None
            a = actual["generation"] if actual else None
            rows.append({
                "startTime": target, "settlementPeriod": period + 1,
                "forecastMW": f, "actualMW": a,
                "publishTime": forecast["publishTime"] if forecast else None,
                "actualPublishTime": actual["publishTime"] if actual else None,
                "errorMW": f - a if f is not None and a is not None else None,
                "leadHours": (datetime.fromisoformat(target.replace("Z", "+00:00")) - datetime.fromisoformat(forecast["publishTime"].replace("Z", "+00:00"))).total_seconds() / 3600 if forecast else None,
            })
        forecasts = [r["forecastMW"] for r in rows if r["forecastMW"] is not None]
        pairs = [(r["forecastMW"], r["actualMW"]) for r in rows if r["errorMW"] is not None]
        publications = sorted({r["publishTime"] for r in rows if r["publishTime"]})
        return {
            "decisionDate": decision_date, "deliveryDate": str(delivery), "cutoff": cutoff,
            "asOf": as_of, "timezone": "Europe/London", "rows": rows,
            "forecastMeanMW": mean(forecasts) if forecasts else None,
            "forecastPeakMW": max(forecasts) if forecasts else None,
            "forecastMinMW": min(forecasts) if forecasts else None,
            "actualMeanMW": mean([a for _, a in pairs]) if pairs else None,
            "forecastPoints": len(forecasts),
            "actualPoints": sum(r["actualMW"] is not None for r in rows),
            "expectedPeriods": 48, "metrics": metrics(pairs),
            "latestPublishTime": publications[-1] if publications else None,
            "oldestPublishTime": publications[0] if publications else None,
            "issueAgeMinutes": (datetime.fromisoformat(as_of.replace("Z", "+00:00")) - datetime.fromisoformat(publications[-1].replace("Z", "+00:00"))).total_seconds() / 60 if publications else None,
        }

    def historical_risk(self, decision_date: str, cutoff: str) -> dict:
        """Only previous complete delivery days, with actuals visible at cutoff.

        There is intentionally no pre-January backfill: the brief restricts
        purchase decisions to January. Early dates have insufficient history.
        """
        decision = date.fromisoformat(decision_date)
        as_of = f"{decision_date}T{cutoff}:00Z"
        errors, included_dates = [], []
        for offset in range(15, 1, -1):
            previous = decision - timedelta(days=offset)
            if previous < FIRST:
                continue
            day = self.base_day(str(previous), cutoff, actual_cutoff=as_of)
            # A previous decision's delivery ends at previous + 2 days 00:00.
            delivery_end = iso(datetime.combine(previous + timedelta(days=2), time(), UTC))
            if delivery_end > as_of:
                continue
            eligible = [r["errorMW"] for r in day["rows"] if r["errorMW"] is not None]
            if eligible:
                errors.extend(eligible)
                included_dates.append(day["deliveryDate"])
        p90 = quantile(errors, 0.9)
        return {
            "sampleCount": len(errors), "deliveryDays": len(included_dates),
            "fromDelivery": included_dates[0] if included_dates else None,
            "toDelivery": included_dates[-1] if included_dates else None,
            "p10ErrorMW": quantile(errors, 0.1), "p90ErrorMW": p90,
            "shortfallAllowanceMW": max(0, p90) if p90 is not None and len(errors) >= 48 else None,
            "maeMW": mean([abs(e) for e in errors]) if errors else None,
            "minimumSamples": 48, "windowDays": 14,
            "method": "Empirical P90 of forecast minus actual from up to 14 earlier completed delivery days; actual publication <= decision cutoff. This is a historical scenario, not a calibrated prediction interval or an order recommendation.",
        }

    def revisions(self, decision_date: str, cutoff: str) -> list[dict]:
        delivery = str(date.fromisoformat(decision_date) + timedelta(days=1))
        issues = defaultdict(list)
        as_of = f"{decision_date}T{cutoff}:00Z"
        for target, versions in self.forecasts.items():
            if target[:10] != delivery:
                continue
            for version in versions:
                if version["publishTime"][:10] == decision_date:
                    issues[version["publishTime"]].append(version["generation"])
        return [{"publishTime": publish, "meanMW": mean(values), "points": len(values),
                 "eligible": publish <= as_of}
                for publish, values in sorted(issues.items())]

    @lru_cache(maxsize=384)
    def day(self, decision_date: str, cutoff: str = "09:50") -> dict:
        return {**self.base_day(decision_date, cutoff),
                "risk": self.historical_risk(decision_date, cutoff),
                "revisions": self.revisions(decision_date, cutoff)}

    @lru_cache(maxsize=24)
    def month(self, cutoff: str = "09:50") -> dict:
        days, pairs, period_pairs = [], [], defaultdict(list)
        for offset in range(31):
            day = self.base_day(str(FIRST + timedelta(days=offset)), cutoff)
            days.append({k: v for k, v in day.items() if k != "rows"})
            for row in day["rows"]:
                if row["errorMW"] is not None:
                    pair = (row["forecastMW"], row["actualMW"])
                    pairs.append(pair)
                    period_pairs[row["settlementPeriod"]].append(pair)
        return {
            "cutoff": cutoff, "days": days, "metrics": metrics(pairs),
            "forecastPoints": sum(d["forecastPoints"] for d in days),
            "actualPoints": sum(d["actualPoints"] for d in days),
            "expectedPeriods": 31 * 48,
            "byPeriod": [{"settlementPeriod": p, **metrics(values)} for p, values in sorted(period_pairs.items())],
        }

    def meta(self) -> dict:
        return {
            "product": "WindProcure", "mode": "verified_historical_snapshot",
            "source": self.payload.get("source", "Elexon BMRS Insights"),
            "fetchedAt": self.payload.get("fetchedAt"),
            "decisionRange": {"from": str(FIRST), "to": str(LAST)},
            "deliveryRange": {"from": "2026-01-02", "to": "2026-02-01"},
            "forecastRevisions": len(self.payload["forecasts"]),
            "actualRows": len(self.payload["actuals"]),
            "forecastTargetMinutes": sorted({int(r["startTime"][14:16]) for r in self.payload["forecasts"]}),
            "requests": self.payload.get("requests", []),
            "warnings": [
                "National Great Britain wind only; no customer demand, price, solar or portfolio data.",
                "Historical actuals are shown for evaluation and were not available at the procurement cutoff.",
                "WINDFOR has hourly targets in this snapshot; score exact timestamp overlaps only. No interpolation.",
                "Source forecasts and actuals may differ in metering coverage or treatment of curtailment. Errors are empirical differences, not a pure forecast-skill attribution.",
            ],
        }


@lru_cache(maxsize=1)
def repository() -> Repository:
    return Repository(json.loads(snapshot_bytes()))


def snapshot_bytes() -> bytes:
    plain = ROOT / "data" / "elexon-january-2026.json"
    if plain.exists():
        return plain.read_bytes()
    # The deployment transports the identical JSON in lossless gzip form.
    return gzip.decompress(plain.with_suffix(".json.gz").read_bytes())


def snapshot_sha256() -> str:
    return hashlib.sha256(snapshot_bytes()).hexdigest()

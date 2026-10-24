from datetime import date, timedelta
import math

import pytest

from backend.analysis import Repository, metrics, quantile, repository


def row(target, published, value):
    return {"startTime": target, "publishTime": published, "generation": value}


def test_selection_excludes_future_revision_and_includes_equal_cutoff():
    target = "2026-01-15T00:00:00Z"
    repo = Repository({"forecasts": [row(target, "2026-01-14T09:20:00Z", 1000), row(target, "2026-01-14T09:50:00Z", 1200), row(target, "2026-01-14T09:50:01Z", 9999)], "actuals": []})
    day = repo.base_day("2026-01-14", "09:50")
    assert day["rows"][0]["forecastMW"] == 1200
    assert day["rows"][0]["publishTime"] == "2026-01-14T09:50:00Z"


def test_latest_selection_is_per_target_not_single_whole_file():
    repo = Repository({"forecasts": [row("2026-01-15T00:00:00Z", "2026-01-14T09:30:00Z", 100), row("2026-01-15T01:00:00Z", "2026-01-14T07:30:00Z", 200)], "actuals": []})
    day = repo.base_day("2026-01-14", "09:50")
    assert day["forecastPoints"] == 2
    assert day["rows"][2]["forecastMW"] == 200
    assert day["oldestPublishTime"] != day["latestPublishTime"]


def test_missing_native_forecast_stays_null_and_zero_is_valid():
    target = "2026-01-15T00:00:00Z"
    repo = Repository({"forecasts": [row(target, "2026-01-14T09:30:00Z", 0)], "actuals": [row(target, "2026-01-15T00:30:00Z", 10), row("2026-01-15T00:30:00Z", "2026-01-15T01:00:00Z", 20)]})
    day = repo.base_day("2026-01-14", "09:50")
    assert day["metrics"]["count"] == 1
    assert day["metrics"]["maeMW"] == 10
    assert day["rows"][1]["forecastMW"] is None
    assert day["rows"][1]["errorMW"] is None


def test_metrics_math_and_error_sign():
    m = metrics([(110, 100), (70, 100)])
    assert m["maeMW"] == 20
    assert m["rmseMW"] == pytest.approx(math.sqrt(500))
    assert m["biasMW"] == -10
    assert m["wapePercent"] == 20
    assert m["overforecastPercent"] == 50
    assert quantile([0, 10], .9) == 9


def test_zero_actual_denominator_and_empty_samples_are_not_nan():
    assert metrics([(10, 0)])["wapePercent"] is None
    assert metrics([])["maeMW"] is None
    assert metrics([])["count"] == 0


def test_january_decision_boundary_includes_february_delivery():
    repo = repository()
    assert repo.day("2026-01-01")["deliveryDate"] == "2026-01-02"
    assert repo.day("2026-01-31")["deliveryDate"] == "2026-02-01"
    with pytest.raises(ValueError):
        repo.day("2025-12-31")
    with pytest.raises(ValueError):
        repo.day("2026-02-01")


def test_risk_cannot_see_later_actual_revisions_or_incomplete_delivery():
    forecasts = [row("2026-01-02T00:00:00Z", "2026-01-01T09:30:00Z", 100)]
    actuals = [row("2026-01-02T00:00:00Z", "2026-01-02T00:30:00Z", 90), row("2026-01-02T00:00:00Z", "2026-01-06T00:30:00Z", 0)]
    repo = Repository({"forecasts": forecasts, "actuals": actuals})
    assert repo.historical_risk("2026-01-02", "09:50")["sampleCount"] == 0
    risk = repo.historical_risk("2026-01-03", "09:50")
    assert risk["p90ErrorMW"] == 10
    assert risk["shortfallAllowanceMW"] is None  # Insufficient sample count.


def test_adding_future_forecasts_and_actuals_does_not_change_decision_risk():
    original = repository()
    modified = {**original.payload, "forecasts": original.payload["forecasts"] + [row("2026-01-15T00:00:00Z", "2026-01-14T23:59:00Z", 999999)], "actuals": original.payload["actuals"] + [row("2026-01-02T00:00:00Z", "2026-02-02T00:00:00Z", 999999)]}
    later = Repository(modified)
    assert later.day("2026-01-14")["risk"] == original.day("2026-01-14")["risk"]
    assert later.day("2026-01-14")["rows"][0]["forecastMW"] == original.day("2026-01-14")["rows"][0]["forecastMW"]


@pytest.mark.parametrize("cutoff", ["09:00", "09:20", "09:50"])
def test_real_snapshot_coverage_units_and_all_selected_forecasts_admissible(cutoff):
    repo = repository()
    month = repo.month(cutoff)
    assert month["metrics"]["count"] == 744
    assert month["expectedPeriods"] == 1488
    assert month["actualPoints"] == 1488
    for offset in range(31):
        day = repo.day(str(date(2026, 1, 1) + timedelta(days=offset)), cutoff)
        assert len(day["rows"]) == 48
        assert day["forecastPoints"] == 24
        for r in day["rows"]:
            if r["publishTime"]:
                assert r["publishTime"] <= day["asOf"]
                assert r["startTime"][:10] == day["deliveryDate"]
                assert r["startTime"][14:16] == "00"
        if day["risk"]["toDelivery"]:
            assert day["risk"]["toDelivery"] < day["decisionDate"]

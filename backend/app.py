"""FastAPI transport. No network calls or mutable storage in the request path."""
from __future__ import annotations

import csv
from datetime import date, time
from io import StringIO
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from .analysis import FIRST, LAST, repository, snapshot_sha256

app = FastAPI(title="WindProcure API", version="1.0.0", description="Elexon-only January 2026 decision replay. Error = forecast - actual, in MW.")
Decision = Annotated[date, Query(description="Purchase decision day, 2026-01-01 to 2026-01-31")]
Cutoff = Annotated[str, Query(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$", description="Europe/London HH:MM; GMT in January. Default: N2EX 09:50.")]


def validate(decision_date: date) -> None:
    if not FIRST <= decision_date <= LAST:
        raise HTTPException(422, "Decision date must be in January 2026; delivery is the following day.")


@app.get("/api/health")
def health():
    try:
        store = repository()
        return {"status": "ok", "dataset": "January 2026 Elexon", "forecastRevisions": len(store.payload["forecasts"]), "snapshotSHA256": snapshot_sha256()}
    except (FileNotFoundError, ValueError):
        raise HTTPException(503, "Dataset unavailable. Run python -m backend.ingest.")


@app.get("/api/meta")
def meta():
    return {**repository().meta(), "snapshotSHA256": snapshot_sha256()}


@app.get("/api/day")
def day(decision_date: Decision = date(2026, 1, 14), cutoff: Cutoff = "09:50"):
    validate(decision_date)
    return repository().day(str(decision_date), cutoff)


@app.get("/api/month")
def month(cutoff: Cutoff = "09:50"):
    return repository().month(cutoff)


@app.get("/api/export.csv")
def export_csv(decision_date: Decision = date(2026, 1, 14), cutoff: Cutoff = "09:50"):
    validate(decision_date)
    result = repository().day(str(decision_date), cutoff)
    output = StringIO()
    fields = ["decisionDate", "asOf", "startTime", "settlementPeriod", "forecastMW", "actualMW", "publishTime", "actualPublishTime", "errorMW", "leadHours"]
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    for row in result["rows"]:
        writer.writerow({"decisionDate": str(decision_date), "asOf": result["asOf"], **row})
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="windprocure-{decision_date}-{cutoff.replace(":", "")}.csv"'})


# Production Docker and Vercel serve the same built React application.
# The API routes are registered before the static mount and remain accessible.
dist = Path(__file__).resolve().parents[1] / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")

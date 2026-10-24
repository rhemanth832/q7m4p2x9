# WindProcure

**An auditable national wind outlook for Great Britain's day-ahead procurement team.**

**Application:** https://q7m4p2x9.vercel.app/  
**API health:** https://q7m4p2x9.vercel.app/api/health  
**Interactive API reference:** https://q7m4p2x9.vercel.app/docs  
**Suggested anonymous repository name:** `q7m4p2x9`

This pilot answers two questions: *What wind forecast could the team actually have seen at its decision cutoff? How large and directional were its historical errors?* It uses only Elexon's WINDFOR forecasts and FUELHH records with `fuelType=WIND`.

## What is included

- React + TypeScript interface using the supplied dark Linear style, local Inter font, Lucide SVG icons and an attributed Unsplash photo.
- Python FastAPI backend, an immutable real Elexon archive and a reproducible data-ingestion command.
- Decision replay for **1–31 January 2026**, with next-day deliveries **2 January–1 February 2026**.
- Per-target publication selection, three auction-time presets, publication history, exact-match accuracy metrics and explicit coverage.
- Decision-time historical wind shortfall scenarios using only earlier completed deliveries and actuals published by the historical cutoff.
- Searchable settlement records, CSV exports, decision briefs, JSON evidence bundles and provenance hashes.
- A non-root multistage Docker image, Compose configuration, Vercel configuration, tests, technical design and a two-part video script.

The data are historical, **not a live feed**. No prices, demand, solar, thermal generation, proprietary portfolio data or synthetic generation series are used. A national wind figure is not a utility's purchase order.

## Start with Docker

Prerequisite: Docker Desktop with Compose enabled.

```sh
docker compose up --build
```

Open **http://localhost:8080**. API reference: **http://localhost:8080/docs**. The committed snapshot makes startup independent of Elexon availability. No API keys or environment secrets are required.

```sh
docker compose down
```

## Start without Docker

Prerequisites: Node.js **22.12+**, Python **3.12**.

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
npm ci
npm run dev:full
```

macOS / Linux:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
npm ci
npm run dev:full
```

Open **http://localhost:4173**; the Python API runs on **127.0.0.1:8000**. The full development command owns both processes. Alternatively, use two terminals: `npm run api` and `npm run dev`.

`npm run dev` by itself starts the React frontend. If the API is unavailable, the frontend can load the committed Python-generated static previews and explicitly labels the result **Verified snapshot preview**. The actual Vercel deployment serves the Python API and is labeled **Python API**. No frontend reimplementation of the metrics is used.

## Analysis rules

1. Select a **decision date**, not a delivery date. Delivery is the following Europe/London calendar day. January is GMT, so timestamps align with UTC without a DST shift.
2. For **each target startTime**, retain the forecast with the largest `publishTime <= decision cutoff`. A later revision never enters the chosen forecast. Older eligible issues may be used if a target is absent from the most recent issue.
3. Choose a cutoff: **09:50 GMT** for N2EX, **09:20 GMT** for EPEX, or **09:00 GMT** for early review. The Python API accepts any valid `HH:MM`. These are explicit pilot presets; a real operational workflow should allow a margin before auction closure.
4. The retrieved WINDFOR data have **hourly target times**, while FUELHH actuals are half-hourly. Score **exact timestamp overlaps only**. The 31 deliveries have 1,488 actual half-hours but **744 matched forecasts**. Missing half-hour forecasts remain null.
5. Error is **forecast minus actual**, in **MW**. Positive error means forecast wind exceeded the outturn, creating wind shortfall exposure. UI power values are divided by 1,000 to display GW. **MW is not MWh**; daily energy is not inferred from the sparse forecast targets.
6. MAE, RMSE, bias and WAPE use the same matched sample. WAPE is `sum(abs(error))/sum(actual)*100`, and is null when its denominator is zero. Missing values never become zeros.
7. The main chart's actuals and accuracy metrics are **retrospective**, explicitly labeled. The decision brief's empirical P90 shortfall uses up to 14 earlier **completed** delivery days with actual publication by the current decision cutoff. It requires at least 48 points. Early-January decisions intentionally show insufficient history.
8. The empirical P90 is a **historical scenario**, not a calibrated prediction interval, recommended purchase amount, guarantee or modeled distribution. The portfolio inputs needed to turn a national signal into a purchase requirement are outside the brief.
9. Elexon's forecast and outturn series may differ in metering coverage or curtailment treatment. Their empirical difference must not be attributed entirely to forecasting skill.

### January 2026 result at 09:50 GMT

| Metric | Value |
|---|---:|
| Matched target points | 744 |
| MAE | 1,995.57 MW |
| RMSE | 2,498.82 MW |
| Mean bias, forecast − actual | +1,727.98 MW |
| WAPE | 17.6826% |
| Targets with overforecast wind | 84.2742% |

These are calculated from the retrieved archive, not illustrative values. The archive contains 18,688 forecast revisions and 1,536 wind actuals, including boundary context. See [docs/ANALYSIS.md](docs/ANALYSIS.md) for interpretation.

## Files and directories

| Path | Purpose |
|---|---|
| `src/App.tsx` | Navigation, decision controls, dashboard, accuracy, explorer, methodology and pilot guide |
| `src/components/Charts.tsx` | Accessible SVG time-series chart, errors, sparklines and monthly chart |
| `src/data.ts` | Abortable API reads, labeled static fallback, formatting and exports |
| `src/types.ts` | Shared frontend data contracts |
| `src/styles.css`, `src/tokens.css` | Responsive UI styling and supplied design tokens |
| `backend/ingest.py` | Elexon daily retrieval, bounded retries, normalization, duplicate conflict checks and provenance |
| `backend/analysis.py` | Indexed revisions, cutoff selection, exact joins, metrics and historical risk |
| `backend/app.py` | Validated API endpoints, CSV and production React static serving |
| `app.py` | Vercel FastAPI entrypoint |
| `data/elexon-january-2026.json` | Normalized real Elexon archive with request hashes and retrieval timestamps |
| `data/elexon-january-2026.json.gz` | Lossless compact copy for deployment; decompressed hash is identical |
| `data/raw/` | Ignored raw responses produced during an optional refresh |
| `public/snapshots/` | 97 precomputed JSON preview files generated by the same Python analysis |
| `public/wind-farm.jpg`, `public/inter.ttf` | Locally bundled attributed photograph and font |
| `scripts/export_snapshot.py` | Regenerate the UI preview from the canonical Python analysis |
| `scripts/dev.mjs` | Cross-platform full development runner |
| `tests/` | Analysis and API tests, including anti-leakage and boundary cases |
| `docs/ARCHITECTURE.md` | Technical design, contracts, choices, limits and review route |
| `docs/ANALYSIS.md` | Data interpretation, formulas and measured results |
| `docs/DEMO_SCRIPT.md` | Customer pitch and internal technical walkthrough |
| `docs/SUBMISSION.md` | Honest submission status, link checks and remaining account steps |
| `docs/SOURCES.md` | Primary domain references, asset sources and licenses |
| `design/` | Original supplied design reference and token files |
| `Dockerfile`, `compose.yaml` | Production container and one-command local startup |
| `vercel.json`, `pyproject.toml` | Python runtime, build and entrypoint configuration |
| `.github/workflows/ci.yml` | Build, backend tests and Docker smoke test on GitHub Actions |

## API examples

```text
GET /api/health
GET /api/meta
GET /api/day?decision_date=2026-01-14&cutoff=09:50
GET /api/month?cutoff=09:50
GET /api/export.csv?decision_date=2026-01-14&cutoff=09:50
GET /docs
```

Out-of-scope dates and invalid times return **422**. If the dataset is missing, `/api/health` returns **503** with a recovery message. API routes are registered before the React static mount.

## Refresh the archive

The submitted pilot works offline from the committed data. To re-fetch from the same two public datasets:

```sh
python -m backend.ingest --workers 5
python scripts/export_snapshot.py
python scripts/compress_snapshot.py
python -m pytest tests -q
```

The ingestion windows are 31 December–31 January for forecast publications and 1 January–1 February for actual settlement dates. API inclusivity is handled with explicit local half-open filters. Equal-publication conflicting duplicate values fail validation. A failed retrieval fails the refresh instead of silently producing a partial archive. Raw response hashes and fetch timestamps are retained. Restart the API after refreshing to clear its in-memory cache.

## Tests and validation

```sh
python -m pytest tests -q
npm run build
```

**Validated:** 15 backend tests passed; TypeScript and production build passed; live Vercel root and Python API returned HTTP 200 without credentials; the January 31 decision returned February 1 delivery. Browser checks exercised cutoff changes, navigation, publication history, settlement filters, an empty search state and exports.

**Docker limitation:** Docker is not installed in the development execution environment, so a local container build was not run here. A GitHub Actions Docker build and health smoke test are provided; do not report that check as passed until it actually runs.

## Deploy to Vercel

The included configuration uses Vercel's supported FastAPI entrypoint and promotes the built React static files from the FastAPI mount. API requests run Python. The archive is bundled, so a serverless request never depends on a new Elexon call or writable disk.

To redeploy from this directory with your authenticated Vercel CLI:

```sh
npx vercel --prod
```

Or import a public GitHub repository into Vercel. Keep the repository root as the project root, use the **FastAPI** framework, and retain the supplied build command. No environment variables are needed. Confirm the app and `/api/health` are publicly accessible before submitting; preview protection must not block the evaluator.

## Video and submission

The deliverable package includes a narrated MP4 with a customer pilot presentation and an internal technical walkthrough, plus a transcript and captions. The voice is synthesized and does not impersonate the candidate. Review the video and, if preferred, record the supplied script in your own voice.

**An unlisted YouTube upload is still an external account step unless a verified link is recorded in `docs/SUBMISSION.md`. Do not submit the challenge without its required YouTube video.** The challenge text supplied no actual submission-form URL. Public GitHub repository creation and the form must be verified independently; a ZIP is not a substitute for the required public repository.

## AI assistance disclosure

**AI tools were used.** OpenAI ChatGPT/Codex assisted with domain research, architecture, implementation, tests, UI design, documentation, review and the demonstration script. The optional demonstration narration uses the open-source Piper text-to-speech engine and a generic licensed voice model. Elexon data and reported metrics are real retrieved observations and deterministic Python calculations. No AI-generated generation data or fabricated results were used.

## Attribution

- Design reference and tokens: supplied by the user; adapted for this application.
- Icons: [Lucide](https://lucide.dev/), ISC license.
- Photo: [雙 film, Unsplash](https://unsplash.com/photos/NPC-qhyoX78), Unsplash License; bundled locally. It illustrates offshore wind and is not asserted to depict a particular British installation.
- Typeface: [Inter](https://rsms.me/inter/), SIL Open Font License 1.1.
- Elexon datasets: attribution to Elexon BMRS Insights; consult the source terms before reuse outside this pilot. No blanket relicensing of source data is asserted.

See [docs/SOURCES.md](docs/SOURCES.md) for source links and licensing notes.

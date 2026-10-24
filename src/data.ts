import type { DataMode, Day, Meta, Month } from './types';

async function get<T>(api: string, snapshot: string, signal: AbortSignal): Promise<{ data: T; mode: DataMode }> {
  try {
    const response = await fetch(api, { signal, headers: { Accept: 'application/json' } });
    if (response.status === 422) throw new Error('Please choose a decision date in January 2026 and a valid cutoff.');
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      return { data: await response.json() as T, mode: 'api' };
    }
    if (response.status === 401 || response.status === 403) throw new Error('The API requires access. Please check the deployment settings.');
  } catch (error) {
    if (signal.aborted || (error instanceof Error && /Please choose|requires access/.test(error.message))) throw error;
  }
  const response = await fetch(snapshot, { signal });
  if (!response.ok) throw new Error('The verified snapshot could not be loaded. Please retry.');
  return { data: await response.json() as T, mode: 'snapshot' };
}

export async function loadData(decision: string, cutoff: string, signal: AbortSignal) {
  const compact = cutoff.replace(':', '');
  const [day, month, meta] = await Promise.all([
    get<Day>(`/api/day?decision_date=${decision}&cutoff=${cutoff}`, `/snapshots/day-${decision}-${compact}.json`, signal),
    get<Month>(`/api/month?cutoff=${cutoff}`, `/snapshots/month-${compact}.json`, signal),
    get<Meta>('/api/meta', '/snapshots/meta.json', signal),
  ]);
  return { day: day.data, month: month.data, meta: meta.data, mode: day.mode };
}

export const number = (value: number | null | undefined, digits = 2) => value == null ? '—' : value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const gw = (value: number | null | undefined, digits = 2) => value == null ? '—' : number(value / 1000, digits);
export const clock = (value: string | null | undefined) => value ? value.slice(11, 16) : '—';
export const shortDate = (value: string, opts: Intl.DateTimeFormatOptions = {}) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', ...opts, timeZone: 'Europe/London' });

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv(day: Day) {
  const fields = ['decisionDate', 'asOf', 'startTime', 'settlementPeriod', 'forecastMW', 'actualMW', 'publishTime', 'actualPublishTime', 'errorMW', 'leadHours'] as const;
  const lines = day.rows.map(row => {
    const record = { decisionDate: day.decisionDate, asOf: day.asOf, ...row };
    return fields.map(field => JSON.stringify(record[field] ?? '')).join(',');
  });
  download(`windprocure-${day.decisionDate}.csv`, [fields.join(','), ...lines].join('\n'), 'text/csv');
}

export function exportBrief(day: Day, meta: Meta) {
  const report = `# WindProcure — decision brief\n\nDecision: ${day.decisionDate} at ${day.cutoff} GMT\nDelivery: ${day.deliveryDate}\nSource: Elexon WINDFOR and FUELHH/WIND\n\n## Wind outlook available at cutoff\n- Mean of ${day.forecastPoints} observed forecast targets: ${gw(day.forecastMeanMW)} GW\n- Peak observed target: ${gw(day.forecastPeakMW)} GW\n- Latest eligible publication: ${day.latestPublishTime}\n- Forecast coverage: ${day.forecastPoints}/${day.expectedPeriods} half-hour timestamps. No interpolation.\n\n## Decision-time historical scenario\n- Empirical P90 shortfall allowance: ${gw(day.risk.shortfallAllowanceMW)} GW\n- History: ${day.risk.sampleCount} matched points over ${day.risk.deliveryDays} earlier completed delivery days\n- ${day.risk.method}\n\n## Retrospective evaluation (actuals unavailable at the decision)\n- MAE: ${gw(day.metrics.maeMW)} GW\n- RMSE: ${gw(day.metrics.rmseMW)} GW\n- Bias (forecast minus actual): ${gw(day.metrics.biasMW)} GW\n- WAPE: ${number(day.metrics.wapePercent)}%\n- Matched points: ${day.metrics.count}\n\n## Scope and provenance\nNational Great Britain wind only; this is not a utility purchase instruction. Demand, portfolio share, prices and other generation are outside scope. MW values are not MWh. Forecast and outturn metering coverage can differ.\n\nFetched: ${meta.fetchedAt}\nSnapshot SHA-256: ${meta.snapshotSHA256}\n\nForecasts: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream\nActuals: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream\n`;
  download(`windprocure-brief-${day.decisionDate}.md`, report, 'text/markdown');
}

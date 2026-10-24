import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Info } from 'lucide-react';
import type { Day, Month, Period } from '../types';
import { clock, gw, number, shortDate } from '../data';

export function Sparkline({ values, muted = false }: { values: (number | null)[]; muted?: boolean }) {
  const clean = values.filter((v): v is number => v != null);
  if (!clean.length) return null;
  const min = Math.min(...clean), max = Math.max(...clean);
  const points = clean.map((v, i) => `${i / Math.max(1, clean.length - 1) * 90},${29 - ((v - min) / (max - min || 1)) * 24}`).join(' ');
  return <svg viewBox="0 0 92 34" className={`sparkline ${muted ? 'muted' : ''}`} aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.7" vectorEffect="non-scaling-stroke" /></svg>;
}

export function MetricCard({ label, value, unit = 'GW', detail, values, direction, title }: {
  label: string; value: string; unit?: string; detail: string;
  values?: (number | null)[]; direction?: 'up' | 'down'; title: string;
}) {
  return <article className="metric-card">
    <div className="metric-label">{label}<span title={title} aria-label={title}><Info size={13} /></span></div>
    <div className="metric-body"><div className="metric-value">{value}<span>{unit}</span></div>{values && <Sparkline values={values} muted />}</div>
    <div className="metric-detail">{direction === 'up' ? <ArrowUpRight size={13} /> : direction === 'down' ? <ArrowDownRight size={13} /> : <span className="tiny-square" />}{detail}</div>
  </article>;
}

function pathFor(rows: Period[], key: 'forecastMW' | 'actualMW', x: (i: number) => number, y: (v: number) => number, start: number) {
  let path = '', previous = -99;
  rows.forEach((row, i) => {
    const value = row[key];
    if (value == null) return;
    const index = row.settlementPeriod - 1;
    const disconnected = key === 'forecastMW' ? index - previous > 2 : index - previous > 1;
    path += `${disconnected ? 'M' : 'L'}${x(index - start).toFixed(2)},${y(value).toFixed(2)} `;
    previous = index;
  });
  return path;
}

export function GenerationChart({ day }: { day: Day }) {
  const [showActual, setShowActual] = useState(true);
  const [active, setActive] = useState<number | null>(null);
  const [window, setWindow] = useState('all');
  const [errorView, setErrorView] = useState(false);
  const width = 860, height = 290, left = 48, right = 22, top = 28, bottom = 38;
  const start = window === 'morning' ? 0 : window === 'day' ? 16 : window === 'evening' ? 32 : 0;
  const count = window === 'all' ? 48 : 16;
  const rows = day.rows.slice(start, start + count);
  const values = rows.flatMap(r => [r.forecastMW, ...(showActual ? [r.actualMW] : [])]).filter((v): v is number => v != null);
  const max = Math.max(4000, Math.ceil(Math.max(...values, 0) / 4000) * 4000);
  const maxError = Math.max(1000, Math.ceil(Math.max(...rows.map(r => Math.abs(r.errorMW ?? 0))) / 1000) * 1000);
  const x = (i: number) => left + i / count * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const ey = (value: number) => top + (1 - (value + maxError) / (2 * maxError)) * (height - top - bottom);
  const forecastPath = pathFor(rows, 'forecastMW', x, y, start);
  const actualPath = pathFor(rows, 'actualMW', x, y, start);
  const forecastRows = rows.filter(r => r.forecastMW != null);
  const first = forecastRows[0], last = forecastRows[forecastRows.length - 1];
  const area = first && last ? `${forecastPath} L${x(last.settlementPeriod - 1 - start)},${y(0)} L${x(first.settlementPeriod - 1 - start)},${y(0)} Z` : '';
  const focused = active == null ? null : day.rows[active];
  const focusedInWindow = focused && active! >= start && active! < start + count;
  const ticks = errorView ? [-maxError, -maxError / 2, 0, maxError / 2, maxError] : [0, max / 4, max / 2, max * 3 / 4, max];

  return <section className="panel generation-panel">
    <div className="panel-heading"><div><h2>Wind generation outlook <span className="tag">GB NATIONAL</span></h2><p>{shortDate(day.deliveryDate, { weekday: 'long' })}, 2026 <span className="dot-separator">·</span> Power in GW</p></div>
      <div className="mini-select"><select aria-label="Chart time window" value={window} onChange={e => { setWindow(e.target.value); setActive(null); }}><option value="all">Full delivery day</option><option value="morning">00:00–08:00</option><option value="day">08:00–16:00</option><option value="evening">16:00–24:00</option></select><ChevronDown size={12} /></div>
    </div>
    <div className="chart-toolbar"><div className="segmented small"><button className={!errorView ? 'selected' : ''} onClick={() => setErrorView(false)}>Power profile</button><button className={errorView ? 'selected' : ''} onClick={() => setErrorView(true)}>Forecast error</button></div>
      <div className="chart-legend"><span><i className="legend-line lime" />{errorView ? 'Forecast − actual' : 'As-of forecast'}</span>{!errorView && <button className={`legend-toggle ${showActual ? '' : 'off'}`} onClick={() => setShowActual(!showActual)} aria-pressed={showActual}><i className="legend-line actual" />Actual outturn</button>}</div></div>
    <div className="chart-interaction" tabIndex={0} role="group" aria-label="Interactive generation chart. Use left and right arrow keys to inspect settlement periods." onKeyDown={event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setActive(Math.max(start, Math.min(start + count - 1, (active ?? start) + (event.key === 'ArrowRight' ? 1 : -1)))); }
      if (event.key === 'Escape') setActive(null);
    }} onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="generation-chart" role="img" aria-label={`${errorView ? 'Forecast errors' : 'Forecast and actual wind generation'} for ${day.deliveryDate}. ${day.forecastPoints} observed forecast targets, ${day.metrics.count} matched actuals.`} onMouseMove={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const sx = (event.clientX - rect.left) / rect.width * width;
        setActive(Math.max(start, Math.min(start + count - 1, Math.round((sx - left) / (width - left - right) * count) + start)));
      }}>
        <defs><linearGradient id="wind-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e4f222" stopOpacity="0.11" /><stop offset="100%" stopColor="#e4f222" stopOpacity="0" /></linearGradient></defs>
        {ticks.map(tick => <g key={tick}><line x1={left} x2={width - right} y1={errorView ? ey(tick) : y(tick)} y2={errorView ? ey(tick) : y(tick)} stroke={tick === 0 && errorView ? '#4b4f55' : '#25272a'} strokeDasharray={tick === 0 && errorView ? '' : '3 5'} strokeWidth=".7" /><text x={left - 14} y={(errorView ? ey(tick) : y(tick)) + 4} textAnchor="end">{number(tick / 1000, 0)}</text></g>)}
        <text x="13" y="14" className="chart-axis-unit">GW</text>
        {Array.from({ length: window === 'all' ? 7 : 5 }, (_, i) => {
          const offset = i * count / (window === 'all' ? 6 : 4);
          const hour = (start + offset) / 2;
          return <text key={i} x={x(offset)} y={height - 10} textAnchor="middle">{`${String(hour).padStart(2, '0')}:00`}</text>;
        })}
        {!errorView && <><path d={area} fill="url(#wind-area)" />{showActual && <path d={actualPath} stroke="#8a939e" fill="none" strokeWidth="1.8" strokeDasharray="5 5" />}<path d={forecastPath} stroke="#e4f222" fill="none" strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round" />{forecastRows.map(row => <circle key={row.startTime} cx={x(row.settlementPeriod - 1 - start)} cy={y(row.forecastMW!)} r="2.4" fill="#e4f222" stroke="#0f1011" strokeWidth="1" />)}</>}
        {errorView && rows.filter(r => r.errorMW != null).map(row => <rect key={row.startTime} x={x(row.settlementPeriod - 1 - start) - (width - left - right) / count * .33} y={Math.min(ey(row.errorMW!), ey(0))} width={(width - left - right) / count * .66} height={Math.max(1, Math.abs(ey(row.errorMW!) - ey(0)))} rx="2" fill={row.errorMW! > 0 ? '#ddbd86' : '#72aaa7'} opacity=".85" />)}
        {focusedInWindow && <g><line x1={x(active! - start)} x2={x(active! - start)} y1={top} y2={height - bottom} stroke="#73777d" strokeDasharray="3 4" />{!errorView && focused.forecastMW != null && <circle cx={x(active! - start)} cy={y(focused.forecastMW)} r="4" fill="#e4f222" stroke="#0f1011" strokeWidth="2" />}</g>}
      </svg>
      {focusedInWindow && <div className={`chart-tooltip ${active! > start + count / 2 ? 'left' : 'right'}`} aria-live="polite"><b>{clock(focused.startTime)} GMT <span>SP {focused.settlementPeriod}</span></b><div><span>As-of forecast</span><strong>{gw(focused.forecastMW)} GW</strong></div>{showActual && <div><span>Actual outturn</span><strong>{gw(focused.actualMW)} GW</strong></div>}<div><span>Forecast − actual</span><strong>{gw(focused.errorMW)} GW</strong></div><p>{focused.publishTime ? `Published ${clock(focused.publishTime)} · ${number(focused.leadHours, 1)}h lead` : 'No native forecast at this timestamp'}</p></div>}
    </div>
    <div className="chart-footnote"><span><span className="status-dot" />{day.forecastPoints} native forecast points <span className="dot-separator">·</span> no interpolation</span><span>Actuals shown retrospectively <Info size={12} /></span></div>
  </section>;
}

export function MonthlyChart({ month, onDay }: { month: Month; onDay: (day: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.ceil(Math.max(...month.days.map(d => d.metrics.maeMW ?? 0), 1000) / 1000) * 1000;
  return <div className="monthly-chart"><div className="monthly-y-axis"><span>{number(max / 1000, 0)}</span><span>{number(max / 2000, 1)}</span><span>0</span></div><div className="bar-grid">{month.days.map((day, i) => <button className={`month-bar ${hover === i ? 'hovered' : ''}`} key={day.decisionDate} style={{ height: `${Math.max(2, (day.metrics.maeMW ?? 0) / max * 100)}%` }} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)} onClick={() => onDay(day.decisionDate)} aria-label={`Decision ${shortDate(day.decisionDate)}: MAE ${gw(day.metrics.maeMW)} GW. Open decision.`}><span>{String(i + 1).padStart(2, '0')}</span></button>)}</div>{hover != null && <div className="month-tooltip">Decision {shortDate(month.days[hover].decisionDate)} <b>MAE {gw(month.days[hover].metrics.maeMW)} GW</b></div>}<div className="bar-axis"><span>01 JAN</span><span>08 JAN</span><span>16 JAN</span><span>24 JAN</span><span>31 JAN</span></div></div>;
}

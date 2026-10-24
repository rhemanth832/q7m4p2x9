import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Database, Download, ExternalLink, FileJson, FileText, History, Info, Layers3, Menu, RefreshCw, Search, ShieldCheck, Table2, Wind, X } from 'lucide-react';
import type { DataMode, Day, Meta, Month, Period, View } from './types';
import { clock, download, exportBrief, exportCsv, gw, loadData, number, shortDate } from './data';
import { GenerationChart, MetricCard, MonthlyChart, Sparkline } from './components/Charts';

const navigation: { id: View; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Day-ahead overview', icon: Activity },
  { id: 'accuracy', label: 'Forecast accuracy', icon: ChartNoAxesCombined },
  { id: 'explorer', label: 'Forecast explorer', icon: History },
  { id: 'methodology', label: 'Data & methodology', icon: Database },
  { id: 'guide', label: 'Pilot guide', icon: BookOpen },
];

function getInitialView(): View {
  const view = window.location.hash.slice(1);
  return navigation.find(n => n.id === view)?.id ?? 'overview';
}

function DatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [focusDate, setFocusDate] = useState(Number(value.slice(-2)));
  const day = Number(value.slice(-2));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  function move(offset: number) { onChange(`2026-01-${String(day + offset).padStart(2, '0')}`); }
  return <div className="date-control" ref={ref}>
    <CalendarDays size={15} /><span className="control-label">Decision day</span>
    <button className="date-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(!open); setFocusDate(day); }}>{shortDate(value)} 2026<ChevronDown size={13} /></button>
    <div className="date-arrows"><button aria-label="Previous decision day" disabled={day === 1} onClick={() => move(-1)}><ChevronLeft size={15} /></button><button aria-label="Next decision day" disabled={day === 31} onClick={() => move(1)}><ChevronRight size={15} /></button></div>
    {open && <div className="calendar-popover" role="dialog" aria-label="Choose January 2026 decision day" onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>
      <div className="calendar-heading"><b>January 2026</b><span>Decision dates</span></div>
      <div className="calendar-grid">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((v, i) => <span key={`label-${i}`}>{v}</span>)}{Array.from({ length: 3 }, (_, i) => <span key={`empty-${i}`} />)}{Array.from({ length: 31 }, (_, i) => <button key={i} className={day === i + 1 ? 'chosen' : ''} tabIndex={focusDate === i + 1 ? 0 : -1} onKeyDown={e => {
        const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? 7 : e.key === 'ArrowUp' ? -7 : 0;
        if (delta) { e.preventDefault(); const n = Math.max(1, Math.min(31, i + 1 + delta)); setFocusDate(n); ref.current?.querySelector<HTMLButtonElement>(`[data-day="${n}"]`)?.focus(); }
      }} data-day={i + 1} aria-label={`${i + 1} January 2026`} aria-pressed={day === i + 1} onClick={() => { onChange(`2026-01-${String(i + 1).padStart(2, '0')}`); setOpen(false); }}>{i + 1}</button>)}</div>
      <p>Delivery is the following day.</p>
    </div>}
  </div>;
}

function SettlementTable({ rows, compact = false }: { rows: Period[]; compact?: boolean }) {
  return <div className="table-scroll"><table className={`data-table ${compact ? 'compact' : ''}`}><thead><tr><th>Delivery time <span>GMT</span></th><th>Forecast <span>MW</span></th><th>Actual <span>MW</span></th><th>Error <span>MW</span></th>{!compact && <><th>Published <span>GMT</span></th><th>Lead time</th></>}</tr></thead><tbody>{rows.map(row => <tr key={row.startTime}><td><span className="time-cell">{clock(row.startTime)}<span>SP {String(row.settlementPeriod).padStart(2, '0')}</span></span></td><td>{row.forecastMW == null ? <span className="missing">No native target</span> : number(row.forecastMW, 0)}</td><td>{number(row.actualMW, 0)}</td><td className={row.errorMW == null ? '' : row.errorMW > 0 ? 'error-positive' : 'error-negative'}>{row.errorMW == null ? '—' : `${row.errorMW > 0 ? '+' : ''}${number(row.errorMW, 0)}`}</td>{!compact && <><td>{clock(row.publishTime)}</td><td>{row.leadHours == null ? '—' : `${number(row.leadHours, 1)}h`}</td></>}</tr>)}</tbody></table></div>;
}

function DecisionBrief({ day, onMethodology }: { day: Day; onMethodology: () => void }) {
  const risk = day.risk;
  return <aside className="panel brief-panel"><div className="brief-heading"><div className="icon-box"><Layers3 size={17} /></div><span>THE DECISION BRIEF</span><span className="subtle-dot" /></div><h2>Plan for the<br />wind you can count on.</h2><p className="brief-description">A national wind signal for your<br className="desktop-break" /> day-ahead procurement review.</p>
    <div className="brief-outlook"><span>AS-OF WIND OUTLOOK</span><strong>{gw(day.forecastMeanMW)}<small>GW</small></strong><p>Mean of {day.forecastPoints} native target points</p></div>
    <div className="brief-risk"><div><span>Historical P90 shortfall</span><Info size={13} aria-label="Empirical historical scenario, not a confidence interval" /></div><strong>{gw(risk.shortfallAllowanceMW)} <small>GW</small></strong><p>{risk.shortfallAllowanceMW == null ? `More history needed · ${risk.sampleCount}/${risk.minimumSamples} minimum points` : `${risk.sampleCount} earlier matched points · ${risk.deliveryDays} completed days`}</p></div>
    <div className="brief-note"><ShieldCheck size={15} /><p>Only information available at the cutoff informs this scenario.</p></div>
    <button className="brief-link" onClick={onMethodology}>Understand the methodology<ArrowUpRight size={14} /></button>
  </aside>;
}

function Overview({ day, month, navigate }: { day: Day; month: Month; navigate: (view: View) => void }) {
  return <>
    <div className="metrics-grid">
      <MetricCard label="Average wind forecast" value={gw(day.forecastMeanMW)} detail={`${day.forecastPoints} hourly target points`} values={day.rows.map(r => r.forecastMW)} title="Arithmetic mean of observed native WINDFOR targets available at the selected cutoff; not a full half-hourly profile." />
      <MetricCard label="Peak wind forecast" value={gw(day.forecastPeakMW)} detail={`${shortDate(day.deliveryDate)} delivery day`} values={day.rows.map(r => r.forecastMW).reverse()} title="Highest observed native forecast target for the delivery day." />
      <MetricCard label="Mean absolute error" value={gw(day.metrics.maeMW)} detail={`${day.metrics.count} matched points · retrospective`} values={day.rows.map(r => r.errorMW == null ? null : Math.abs(r.errorMW))} title="Mean |forecast − actual|, using only exact overlapping target timestamps. Actuals were unavailable at decision time." />
      <MetricCard label="Forecast bias" value={`${(day.metrics.biasMW ?? 0) > 0 ? '+' : ''}${gw(day.metrics.biasMW)}`} direction={(day.metrics.biasMW ?? 0) >= 0 ? 'up' : 'down'} detail={(day.metrics.biasMW ?? 0) >= 0 ? 'Overforecast · shortfall exposure' : 'Underforecast · excess wind'} values={day.rows.map(r => r.errorMW)} title="Mean forecast − actual. Positive means less wind materialized than forecast; negative means more wind materialized." />
    </div>
    <div className="primary-grid"><GenerationChart day={day} /><DecisionBrief day={day} onMethodology={() => navigate('methodology')} /></div>
    <div className="secondary-grid"><section className="panel insight-panel"><div className="panel-heading"><div><h2>From forecast to decision</h2><p>Two signals worth taking to the trading desk.</p></div><span className="tag">POINT-IN-TIME</span></div><div className="insight-row"><span className="insight-number">01</span><div><h3>A {number(day.issueAgeMinutes, 0)}-minute-old outlook at cutoff</h3><p>The latest eligible publication was {clock(day.latestPublishTime)} GMT, before your {day.cutoff} decision. Later revisions are excluded.</p></div><Clock3 size={16} /></div><div className="insight-row"><span className="insight-number">02</span><div><h3>{number(day.metrics.overforecastPercent, 0)}% of matched targets overforecast wind</h3><p>On this delivery day, the mean forecast error was {gw(day.metrics.biasMW)} GW. Review the full January pattern before drawing conclusions.</p></div><ChartNoAxesCombined size={16} /></div><button className="text-link" onClick={() => navigate('accuracy')}>Explore January accuracy<ArrowRight size={14} /></button></section>
      <section className="panel coverage-panel"><div className="panel-heading"><div><h2>Know your coverage</h2><p>Transparent data, honest comparisons.</p></div><Database size={16} /></div><div className="coverage-stat"><span>Forecast target points</span><b>{day.forecastPoints}<small> / {day.expectedPeriods}</small></b></div><div className="coverage-track">{day.rows.map(row => <i key={row.startTime} className={row.forecastMW == null ? '' : 'present'} title={`${clock(row.startTime)}: ${row.forecastMW == null ? 'No native forecast' : `${row.forecastMW} MW`}`} />)}</div><div className="coverage-legend"><span><i />Observed forecast</span><span><i />No native target</span></div><div className="coverage-stat bottom"><span>Actual outturn received</span><b>{day.actualPoints}<small> / 48</small><Check size={13} /></b></div><p className="coverage-note">Hourly forecasts are matched to the same half-hour start time. No filled gaps enter the {month.metrics.count}-point monthly evaluation.</p></section></div>
    <section className="panel settlement-preview"><div className="panel-heading"><div><h2>Settlement detail</h2><p>The numbers behind the profile. First six of 48 periods.</p></div><button className="ghost-button" onClick={() => navigate('explorer')}>Explore all periods<ArrowUpRight size={14} /></button></div><SettlementTable rows={day.rows.slice(0, 6)} compact /></section>
  </>;
}

function Accuracy({ month, onDay }: { month: Month; onDay: (day: string) => void }) {
  const m = month.metrics;
  return <>
    <div className="context-banner"><Info size={15} /><span>Retrospective evaluation of <b>1–31 January decisions</b> → 2 January–1 February deliveries. Forecasts are frozen at {month.cutoff} GMT each decision day.</span></div>
    <div className="metrics-grid"><MetricCard label="Mean absolute error" value={gw(m.maeMW)} detail={`${m.count} exact matched targets`} title="Sum of absolute errors divided by matched target count." /><MetricCard label="Root mean square error" value={gw(m.rmseMW)} detail="More weight on large misses" title="Square root of the mean squared error, in GW after conversion from MW." /><MetricCard label="Mean forecast bias" value={`+${gw(m.biasMW)}`} detail="Positive = wind shortfall exposure" title="Mean forecast minus actual. A systematic overforecast appears as positive bias." /><MetricCard label="Weighted absolute error" value={number(m.wapePercent)} unit="%" detail="Absolute errors / total actuals" title="WAPE = sum of absolute errors divided by sum of matched actuals, multiplied by 100. This is not MAPE." /></div>
    <section className="panel"><div className="panel-heading"><div><h2>A month of forecast error</h2><p>Daily mean absolute error, GW <span className="dot-separator">·</span> Click a bar to inspect the decision.</p></div><span className="tag">JANUARY 2026</span></div><MonthlyChart month={month} onDay={onDay} /></section>
    <div className="secondary-grid"><section className="panel analysis-copy"><div className="panel-heading"><div><h2>The pattern behind the average</h2><p>Keep the direction of error in the conversation.</p></div></div><div className="large-stat">{number(m.overforecastPercent, 1)}<span>%</span></div><h3>of matched targets overforecast wind</h3><p>A positive bias suggests exposure to less wind than expected. The typical miss is {gw(m.maeMW)} GW, while the largest errors pull RMSE to {gw(m.rmseMW)} GW.</p><p className="fine-print">These figures describe the requested Elexon series. Metering scope and curtailment can contribute to differences; they are not a pure forecast-skill attribution.</p></section><section className="panel analysis-copy"><div className="panel-heading"><div><h2>Score the data you actually have</h2><p>Coverage is part of the result.</p></div></div><div className="large-stat">{m.count}<span>/ {month.expectedPeriods}</span></div><h3>half-hour timestamps can be compared</h3><p>There are {month.forecastPoints} observed forecast targets and {month.actualPoints} actual half-hours across delivery days. Only their exact timestamp overlap enters the metrics.</p><p className="fine-print">No interpolation, zero substitution or invented half-hour forecasts. The default 09:50 cutoff selects the latest eligible publication for each target separately.</p></section></div>
    <section className="panel"><div className="panel-heading"><div><h2>Daily performance</h2><p>Select any decision to view its source forecast.</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Decision day</th><th>Delivery day</th><th>Mean forecast <span>GW</span></th><th>MAE <span>GW</span></th><th>Bias <span>GW</span></th><th>WAPE</th><th>Matched</th><th /></tr></thead><tbody>{month.days.map(day => <tr key={day.decisionDate}><td>{shortDate(day.decisionDate)}</td><td>{shortDate(day.deliveryDate)}</td><td>{gw(day.forecastMeanMW)}</td><td>{gw(day.metrics.maeMW)}</td><td className={(day.metrics.biasMW ?? 0) > 0 ? 'error-positive' : 'error-negative'}>{gw(day.metrics.biasMW)}</td><td>{number(day.metrics.wapePercent, 1)}%</td><td>{day.metrics.count}</td><td><button className="icon-button" onClick={() => onDay(day.decisionDate)} aria-label={`Inspect decision ${day.decisionDate}`}><ArrowUpRight size={15} /></button></td></tr>)}</tbody></table></div></section>
  </>;
}

function Explorer({ day }: { day: Day }) {
  const [tab, setTab] = useState<'settlements' | 'revisions'>('settlements');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const rows = day.rows.filter(row => (filter !== 'matched' || row.errorMW != null) && (filter !== 'shortfall' || (row.errorMW != null && row.errorMW > 0)) && (filter !== 'missing' || row.forecastMW == null) && (!search || clock(row.startTime).includes(search) || String(row.settlementPeriod).padStart(2, '0').includes(search)));
  return <>
    <div className="section-tabs"><button className={tab === 'settlements' ? 'active' : ''} onClick={() => setTab('settlements')}><Table2 size={15} />Settlement periods<span>48</span></button><button className={tab === 'revisions' ? 'active' : ''} onClick={() => setTab('revisions')}><History size={15} />Publication history<span>{day.revisions.length}</span></button></div>
    {tab === 'settlements' ? <section className="panel"><div className="panel-heading"><div><h2>Every period, accounted for</h2><p>{shortDate(day.deliveryDate)} delivery <span className="dot-separator">·</span> Error = forecast − actual</p></div><button className="ghost-button" onClick={() => exportCsv(day)}><Download size={14} />Download CSV</button></div><div className="table-toolbar"><label className="search-input"><Search size={14} /><input placeholder="Search time or period…" aria-label="Search settlement time or period" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Filter settlement periods" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All periods</option><option value="matched">Matched only</option><option value="shortfall">Wind shortfall only</option><option value="missing">No native forecast</option></select><span>{rows.length} periods</span></div>{rows.length ? <SettlementTable rows={rows} /> : <div className="empty-state"><Search size={24} /><h3>No matching periods</h3><p>Try a different time, period number or filter.</p><button className="ghost-button" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button></div>}</section> : <section className="panel"><div className="panel-heading"><div><h2>What was known, and when</h2><p>Publication times shown exactly as returned by Elexon, in GMT.</p></div><span className="tag">CUTOFF {day.cutoff}</span></div><div className="revision-intro"><ShieldCheck size={18} /><p>Each target uses its own latest publication at or before <b>{day.cutoff} GMT</b>. Publications after that time appear here for auditing and never enter the selected forecast.</p></div><div className="revision-list">{day.revisions.map((issue, i) => <div className={`revision-row ${issue.eligible ? '' : 'excluded'}`} key={issue.publishTime}><div className="revision-node">{issue.publishTime === day.latestPublishTime ? <Check size={14} /> : <span />}</div><div><b>{clock(issue.publishTime)} GMT</b><span>{shortDate(issue.publishTime)} · {issue.points} target points</span></div><div><strong>{gw(issue.meanMW)} <small>GW</small></strong><span>Mean forecast</span></div><span className={`issue-status ${issue.publishTime === day.latestPublishTime ? 'selected' : ''}`}>{issue.publishTime === day.latestPublishTime ? 'Selected at cutoff' : issue.eligible ? 'Earlier eligible issue' : 'After cutoff · excluded'}</span>{i === day.revisions.filter(r => r.eligible).length - 1 && <div className="cutoff-divider"><span>DECISION CUTOFF · {day.cutoff} GMT</span></div>}</div>)}</div><p className="panel-bottom-note">Publication history covers issues published on this decision day. The selector also considers older eligible issues when needed.</p></section>}
  </>;
}

function Methodology({ meta, mode }: { meta: Meta; mode: DataMode }) {
  return <>
    <div className="method-intro"><div><span className="eyebrow">BUILT TO BE QUESTIONED</span><h2>Trust starts with<br />showing our working.</h2><p>Two Elexon datasets. One explicit cutoff.<br />A reproducible path from publication to decision.</p></div><img src="/wind-farm.jpg" alt="Offshore wind turbines on the horizon at dusk" /><a className="photo-credit" href="https://unsplash.com/photos/NPC-qhyoX78" target="_blank" rel="noreferrer">Photo: 雙 film / Unsplash<ExternalLink size={11} /></a></div>
    <div className="source-grid"><a className="panel source-card" href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer"><Wind size={22} /><div><h3>WINDFOR</h3><p>Published wind generation forecasts</p><span>{number(meta.forecastRevisions, 0)} forecast revisions · native hourly targets</span></div><ArrowUpRight size={17} /></a><a className="panel source-card" href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer"><Activity size={22} /><div><h3>FUELHH / WIND</h3><p>Half-hourly wind generation outturn</p><span>{number(meta.actualRows, 0)} raw wind actuals · 30-minute resolution</span></div><ArrowUpRight size={17} /></a></div>
    <section className="panel methodology-text"><div className="panel-heading"><div><h2>The analysis contract</h2><p>Assumptions that are visible, testable and consistent.</p></div><ShieldCheck size={18} /></div><div className="method-step"><span>01</span><div><h3>Start with the decision date</h3><p>Only purchase decisions from 1–31 January 2026 are in scope. Delivery is the next local calendar day, so the final delivery is 1 February. Europe/London is GMT throughout this period. Actuals from 1 January and forecasts published 31 December are retained as boundary context.</p></div></div><div className="method-step"><span>02</span><div><h3>Freeze the forecast at the cutoff</h3><p>For each delivery target, choose the maximum publishTime less than or equal to the decision cutoff. Never use the latest forecast available today to score a past decision. The default is N2EX 09:50 GMT; 09:20 EPEX and 09:00 early-review presets are available. The Python API accepts any valid HH:MM.</p><a href="https://support.nordpoolgroup.com/support/solutions/articles/8000088463-about-the-n2ex-day-ahead-auction" target="_blank" rel="noreferrer">Nord Pool auction timing<ExternalLink size={11} /></a></div></div><div className="method-step"><span>03</span><div><h3>Join exact timestamps, preserve gaps</h3><p>Filter FUELHH to fuelType = WIND. Both generation values are in MW. WINDFOR targets are hourly in this archive, while actuals are half-hourly. Match exact startTime values only. Missing forecasts stay missing; no interpolation, daily MWh estimate or zero filling is used.</p></div></div><div className="method-step"><span>04</span><div><h3>Separate hindsight from decision-time evidence</h3><p>Chart actuals and accuracy metrics are retrospective. The shortfall scenario uses up to 14 earlier completed delivery days, with actual publication at or before the current historical cutoff. At least 48 matched samples are required. An empirical P90 is a historical scenario, not a calibrated 90% interval. Early-January decisions may have insufficient history.</p></div></div><div className="method-step"><span>05</span><div><h3>Interpret national wind, within its limits</h3><p>The datasets cover Great Britain national wind; they do not provide the client's demand, contracted renewables, portfolio share, prices or other generation. No absolute purchase requirement is calculated. Scope differences, curtailment and metering can contribute to observed forecast–outturn differences.</p></div></div></section>
    <section className="panel"><div className="panel-heading"><div><h2>Metrics, without mystery</h2><p>All scores use the same set of matched native target points.</p></div></div><div className="formula-grid"><div><b>MAE</b><code>mean(|forecast − actual|)</code><p>The typical size of a miss, regardless of direction.</p></div><div><b>RMSE</b><code>√mean((forecast − actual)²)</code><p>A score that gives larger misses more weight.</p></div><div><b>Bias</b><code>mean(forecast − actual)</code><p>Positive indicates overforecast wind and potential shortfall.</p></div><div><b>WAPE</b><code>Σ|forecast − actual| / Σactual × 100</code><p>A weighted percentage error. Undefined if total actual is zero.</p></div></div></section>
    <section className="panel provenance-panel"><div className="panel-heading"><div><h2>Reproducible by design</h2><p>Archived public data. No hidden synthetic series.</p></div><button className="ghost-button" onClick={() => download('windprocure-provenance.json', JSON.stringify(meta, null, 2), 'application/json')}><FileJson size={14} />Export provenance</button></div><dl><div><dt>Data delivery</dt><dd>{mode === 'api' ? 'Python API · verified historical snapshot' : 'Static preview · computed by the Python backend'}</dd></div><div><dt>Snapshot retrieved</dt><dd>{new Date(meta.fetchedAt).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</dd></div><div><dt>Source requests</dt><dd>{meta.requests.length} archived daily responses with individual SHA-256 hashes</dd></div><div><dt>Snapshot SHA-256</dt><dd className="hash-value">{meta.snapshotSHA256}</dd></div></dl></section>
  </>;
}

function Guide({ navigate }: { navigate: (view: View) => void }) {
  return <>
    <div className="guide-hero"><Wind size={36} /><span className="eyebrow">YOUR FIRST FIVE MINUTES</span><h2>A better-informed<br />day-ahead conversation.</h2><p>Move from “what is the forecast?” to “what did we know,<br />how wrong can it be, and what does that mean?”</p><button className="primary-button" onClick={() => navigate('overview')}>Open the decision view<ArrowRight size={15} /></button></div>
    <div className="guide-grid">{[{ n: '01', title: 'Set the decision, not the delivery', body: 'Choose a January date and an auction cutoff. We show the next day’s wind targets using only forecasts published by that cutoff.', view: 'overview' as View, link: 'Replay a decision' }, { n: '02', title: 'Put the error in context', body: 'Use MAE for the typical miss, RMSE for larger misses, and bias for direction. Check coverage alongside every score.', view: 'accuracy' as View, link: 'Review forecast accuracy' }, { n: '03', title: 'Follow the evidence', body: 'Inspect all 48 periods and every publication on the decision day. Export the CSV or brief for a review with the trading team.', view: 'explorer' as View, link: 'Explore the source records' }].map(item => <button className="panel guide-card" key={item.n} onClick={() => navigate(item.view)}><span>{item.n}</span><h3>{item.title}</h3><p>{item.body}</p><b>{item.link}<ArrowUpRight size={14} /></b></button>)}</div>
    <section className="panel guide-scope"><ShieldCheck size={22} /><div><h3>A focused pilot, with clear boundaries</h3><p>WindProcure shows national wind exposure and forecast accuracy. A portfolio-level buying recommendation needs your demand, contracts and allocation model. Those inputs are outside this Elexon-only pilot.</p></div></section>
  </>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,button')?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const focusable = [...(ref.current?.querySelectorAll<HTMLElement>('button,input,a,[tabindex="0"]') ?? [])];
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="modal" ref={ref} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={18} /></button></div>{children}</div></div>;
}

export default function App() {
  const [view, setView] = useState<View>(getInitialView);
  const [decision, setDecision] = useState('2026-01-14');
  const [cutoff, setCutoff] = useState('09:50');
  const [data, setData] = useState<{ day: Day; month: Month; meta: Meta; mode: DataMode } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [modal, setModal] = useState<'search' | 'help' | null>(null);
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    loadData(decision, cutoff, controller.signal).then(result => { setData(result); setLoading(false); }).catch(err => { if (!controller.signal.aborted) { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, [decision, cutoff, refresh]);
  useEffect(() => {
    const handle = () => setView(getInitialView());
    const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); setModal(previous => previous === 'search' ? null : 'search'); setQuery(''); } };
    window.addEventListener('hashchange', handle); document.addEventListener('keydown', key);
    return () => { window.removeEventListener('hashchange', handle); document.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3500); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!exportRef.current?.contains(event.target as Node)) setExportOpen(false); };
    if (exportOpen) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [exportOpen]);
  function navigate(next: View) { setView(next); window.location.hash = next; setMobileOpen(false); setModal(null); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function openDay(day: string) { setDecision(day); navigate('overview'); }
  function runExport(kind: string) {
    if (!data) return;
    if (kind === 'csv') exportCsv(data.day);
    if (kind === 'brief') exportBrief(data.day, data.meta);
    if (kind === 'json') download(`windprocure-evidence-${decision}.json`, JSON.stringify({ day: data.day, meta: data.meta }, null, 2), 'application/json');
    setExportOpen(false); setToast('Your export is ready. Check your downloads.');
  }
  const headings: Record<View, { title: string; subtitle: string; eyebrow: string }> = {
    overview: { title: 'Tomorrow, in focus.', subtitle: 'The wind outlook behind your next day-ahead decision.', eyebrow: 'DAY-AHEAD INTELLIGENCE' },
    accuracy: { title: 'Understand the uncertainty.', subtitle: 'A clear, quantitative view of January’s forecast performance.', eyebrow: 'FORECAST PERFORMANCE' },
    explorer: { title: 'Every number has a source.', subtitle: 'Trace the forecast from publication to settlement period.', eyebrow: 'FORECAST EXPLORER' },
    methodology: { title: 'The evidence behind the outlook.', subtitle: 'Source data, assumptions and analysis you can audit.', eyebrow: 'DATA & METHODOLOGY' },
    guide: { title: 'Make the most of your pilot.', subtitle: 'A quick guide to an evidence-led procurement review.', eyebrow: 'PILOT GUIDE' },
  };
  const title = headings[view];
  const decisionViews = view === 'overview' || view === 'explorer';

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    {mobileOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}><button className="brand" onClick={() => navigate('overview')} aria-label="WindProcure home"><div className="brand-mark"><Wind size={24} strokeWidth={1.7} /></div><span>WindProcure<span className="brand-dot">.</span></span></button>
      <button className="workspace-switch" onClick={() => { setModal('help'); }}><span className="workspace-avatar">GB</span><span>Energy workspace<small>January 2026 pilot</small></span><ChevronDown size={13} /></button>
      <button className="search-command" onClick={() => { setModal('search'); setQuery(''); }}><Search size={14} /><span>Quick search</span><kbd>⌘ K</kbd></button>
      <div className="nav-label">PROCUREMENT</div><nav aria-label="Main navigation">{navigation.slice(0, 3).map(item => <button className={`nav-item ${view === item.id ? 'active' : ''}`} key={item.id} onClick={() => navigate(item.id)} aria-current={view === item.id ? 'page' : undefined}><item.icon size={16} /><span>{item.label}</span>{view === item.id && <span className="nav-dot" />}</button>)}</nav>
      <div className="nav-label workspace-label">WORKSPACE</div><nav aria-label="Workspace navigation">{navigation.slice(3).map(item => <button className={`nav-item ${view === item.id ? 'active' : ''}`} key={item.id} onClick={() => navigate(item.id)} aria-current={view === item.id ? 'page' : undefined}><item.icon size={16} /><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="pilot-card"><div><span className="status-dot" /><b>January pilot</b><span className="tag">V1.0</span></div><p>Clear forecasts.<br />More informed decisions.</p><button onClick={() => navigate('guide')}>Explore your workspace<ArrowUpRight size={13} /></button></div><button className="source-status" onClick={() => navigate('methodology')}><div className="source-icon"><Database size={15} /></div><span>Elexon data archive<small><span className="status-dot" />Verified historical snapshot</small></span><ChevronRight size={13} /></button><div className="sidebar-footer"><span>GB national wind</span><span>GMT / UTC+0</span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><span className="breadcrumb-home"><Layers3 size={14} />Workspace</span><ChevronRight size={12} /><span>{navigation.find(n => n.id === view)?.label}</span></div><div className="topbar-actions"><span className="historical-badge"><span />Historical replay</span><span className="topbar-divider" /><button className="icon-button" aria-label="Help and keyboard shortcuts" onClick={() => setModal('help')}><CircleHelp size={17} /></button><button className="user-avatar" title="Great Britain procurement pilot" onClick={() => setModal('help')}>GB</button></div></header>
      <main id="main-content" className={`main-content ${loading && data ? 'updating' : ''}`} aria-busy={loading}>
        <div className="page-heading"><div><div className="eyebrow">{title.eyebrow}<span className="eyebrow-divider" /><span>JANUARY 2026</span></div><h1>{title.title}</h1><p>{title.subtitle}</p></div><div className="heading-actions"><button className={`refresh-button icon-button ${loading ? 'spinning' : ''}`} aria-label="Reload verified snapshot" title="Reload the verified archive" disabled={loading} onClick={() => setRefresh(r => r + 1)}><RefreshCw size={16} /></button><div className="export-control" ref={exportRef}><button className="primary-button" aria-expanded={exportOpen} aria-haspopup="menu" disabled={!data || loading} onClick={() => setExportOpen(!exportOpen)}><ArrowDownToLine size={15} />Export report<ChevronDown size={13} /></button>{exportOpen && <div className="export-menu" role="menu"><span>EXPORT THIS DECISION</span><button role="menuitem" onClick={() => runExport('brief')}><FileText size={15} /><span>Decision brief<small>Markdown report</small></span></button><button role="menuitem" onClick={() => runExport('csv')}><Table2 size={15} /><span>Settlement data<small>48 periods · CSV</small></span></button><button role="menuitem" onClick={() => runExport('json')}><FileJson size={15} /><span>Evidence bundle<small>Forecasts + provenance · JSON</small></span></button></div>}</div></div></div>
        {(decisionViews || view === 'accuracy') && <div className="filter-bar"><div className="filter-left">{decisionViews ? <><DatePicker value={decision} onChange={setDecision} /><span className="filter-divider" /><div className="delivery-label"><ArrowRight size={13} /><span>Delivery</span><b>{data && !loading ? shortDate(data.day.deliveryDate) : shortDate(new Date(new Date(`${decision}T00:00Z`).getTime() + 86400000).toISOString())}</b></div></> : <div className="date-control"><CalendarDays size={15} /><span>All January decisions</span><span className="tag">31 DAYS</span></div>}</div><label className="cutoff-control"><Clock3 size={14} /><span>Forecast cutoff</span><select value={cutoff} aria-label="Forecast cutoff" onChange={e => setCutoff(e.target.value)}><option value="09:50">09:50 GMT · N2EX</option><option value="09:20">09:20 GMT · EPEX</option><option value="09:00">09:00 GMT · Early review</option></select><ChevronDown size={12} /></label></div>}
        {error ? <div className="error-state" role="alert"><Info size={28} /><h2>We couldn’t load this decision.</h2><p>{error}</p><button className="primary-button" onClick={() => setRefresh(r => r + 1)}>Try again<RefreshCw size={14} /></button></div> : !data ? <div className="skeleton-layout" aria-label="Loading Elexon snapshot"><div className="skeleton-metrics">{[1, 2, 3, 4].map(i => <div key={i} />)}</div><div className="skeleton-chart" /><p>Loading verified Elexon data…</p></div> : <>
          {view === 'overview' && <Overview day={data.day} month={data.month} navigate={navigate} />}
          {view === 'accuracy' && <Accuracy month={data.month} onDay={openDay} />}
          {view === 'explorer' && <Explorer day={data.day} />}
          {view === 'methodology' && <Methodology meta={data.meta} mode={data.mode} />}
          {view === 'guide' && <Guide navigate={navigate} />}
          <footer className="content-footer"><span><ShieldCheck size={13} />Elexon BMRS Insights <span className="dot-separator">·</span>{data.mode === 'api' ? 'Python API' : 'Verified snapshot preview'}</span><span>National wind. Transparent decisions.<span className="footer-wind"><Wind size={15} /></span></span></footer>
        </>}
      </main>
    </div>
    {toast && <div className="toast" role="status"><Check size={16} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={13} /></button></div>}
    {modal === 'help' && <Modal title="Welcome to WindProcure" close={() => setModal(null)}><div className="help-content"><span className="tag">JANUARY 2026 PILOT</span><p>An auditable national wind outlook for Great Britain’s day-ahead procurement decisions.</p><div><Clock3 size={18} /><span>Choose the <b>decision day</b> and cutoff. Delivery is the following day.</span></div><div><ShieldCheck size={18} /><span>Forecasts published after the cutoff are always excluded. Actuals are shown for retrospective evaluation.</span></div><div><Command size={18} /><span><kbd>Ctrl / ⌘ K</kbd> opens quick search. Use arrow keys on the chart and <kbd>Esc</kbd> to close dialogs.</span></div><button className="primary-button" onClick={() => navigate('guide')}>Take the quick tour<ArrowRight size={15} /></button></div></Modal>}
    {modal === 'search' && <Modal title="Quick search" close={() => setModal(null)}><label className="command-input"><Search size={18} /><input placeholder="Find a view or January decision…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="command-results">{navigation.filter(n => n.label.toLowerCase().includes(query.toLowerCase())).map(n => <button key={n.id} onClick={() => navigate(n.id)}><n.icon size={17} /><span>{n.label}</span><ArrowUpRight size={14} /></button>)}{query && Array.from({ length: 31 }, (_, i) => i + 1).filter(day => `${day} january ${String(day).padStart(2, '0')} jan`.includes(query.toLowerCase())).slice(0, 5).map(day => <button key={day} onClick={() => openDay(`2026-01-${String(day).padStart(2, '0')}`)}><CalendarDays size={17} /><span>Decision · {day} January 2026</span><ArrowUpRight size={14} /></button>)}</div></Modal>}
  </div>;
}

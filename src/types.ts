export type View = 'overview' | 'accuracy' | 'explorer' | 'methodology' | 'guide';
export type DataMode = 'api' | 'snapshot';
export interface Metrics {
  count: number;
  maeMW: number | null;
  rmseMW: number | null;
  biasMW: number | null;
  wapePercent: number | null;
  overforecastPercent: number | null;
  p90AbsMW: number | null;
}
export interface Period {
  startTime: string;
  settlementPeriod: number;
  forecastMW: number | null;
  actualMW: number | null;
  publishTime: string | null;
  actualPublishTime: string | null;
  errorMW: number | null;
  leadHours: number | null;
}
export interface Risk {
  sampleCount: number;
  deliveryDays: number;
  fromDelivery: string | null;
  toDelivery: string | null;
  p10ErrorMW: number | null;
  p90ErrorMW: number | null;
  shortfallAllowanceMW: number | null;
  maeMW: number | null;
  minimumSamples: number;
  windowDays: number;
  method: string;
}
export interface Revision {
  publishTime: string;
  meanMW: number;
  points: number;
  eligible: boolean;
}
export interface Day {
  decisionDate: string;
  deliveryDate: string;
  cutoff: string;
  asOf: string;
  timezone: string;
  rows: Period[];
  forecastMeanMW: number | null;
  forecastPeakMW: number | null;
  forecastMinMW: number | null;
  actualMeanMW: number | null;
  forecastPoints: number;
  actualPoints: number;
  expectedPeriods: number;
  metrics: Metrics;
  latestPublishTime: string | null;
  oldestPublishTime: string | null;
  issueAgeMinutes: number | null;
  risk: Risk;
  revisions: Revision[];
}
export interface Month {
  cutoff: string;
  days: Omit<Day, 'rows' | 'risk' | 'revisions'>[];
  metrics: Metrics;
  forecastPoints: number;
  actualPoints: number;
  expectedPeriods: number;
  byPeriod: (Metrics & { settlementPeriod: number })[];
}
export interface Meta {
  product: string;
  mode: string;
  source: string;
  fetchedAt: string;
  decisionRange: { from: string; to: string };
  deliveryRange: { from: string; to: string };
  forecastRevisions: number;
  actualRows: number;
  forecastTargetMinutes: number[];
  snapshotSHA256: string;
  warnings: string[];
  requests: { dataset: string; date: string; url: string; fetchedAt: string; sha256: string; rawRows: number }[];
}

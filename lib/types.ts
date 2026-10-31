export type Limits = Record<string, number>;
export interface Fee { pct: number; flatNgn?: number; flatUsd?: number; flatWaivedBelowNgn?: number; capNgn?: number; vatPct?: number }
export interface Plan {
  id: string; name: string; priceUSD: number; verified: boolean; source: string;
  limits: Limits; overage?: Limits; creditUSD?: number; capUSD?: number;
  fee?: Fee; tokens?: { inPerM: number; outPerM: number };
  onExceed?: string; notes?: string[];
}
export interface Service {
  id: string; name: string; category: string; icon: string; detect: string[];
  source: string; checkedOn: string; plans: Plan[]; creditFormula?: Record<string, number>;
}
export interface NetworkProfile { id: string; name: string; mbps: number; rttMs: number; source: string; note: string; verified: boolean }
export interface PlansData {
  meta: { checkedOn: string; fx: { ngnPerUsd: number; source: string; checkedOn: string };
    dataCostNgnPerGB: { value: number; source: string; note: string }; networkMix: { source: string; note: string } };
  networks: NetworkProfile[]; services: Service[];
}
export interface Dep { name: string; range: string; dev: boolean; installed?: string; via: 'lockfile' | 'exact' | 'resolved' | 'unknown' }
export interface StackSource { label: string; repoUrl?: string; branch?: string; lockfile?: string; notes: string[] }
export interface Selection { serviceId: string; planId: string; why: string }
export interface Inputs {
  dau: number; pagesPerUser: number; pageWeightKB: number; requestsPerPage: number; apiPerPage: number; dbQueriesPerRequest: number;
  uploadsPerDay: number; uploadMB: number; emailsPerDay: number; aiCallsPerDay: number; aiTokensIn: number; aiTokensOut: number;
  paymentsPerDay: number; avgPaymentNgn: number; growthPct: number; spikeMultiplier: number; spikeDay: number;
  horizon: 'days30' | 'months12'; mix: Record<string, number>; dauToMau: number; imageShare: number;
}

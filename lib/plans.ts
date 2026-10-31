import raw from '../data/plans.json';
import type { PlansData, Service, Plan } from './types';
export const DATA = raw as unknown as PlansData;
export const FX = DATA.meta.fx.ngnPerUsd;
export const svcById = (id: string): Service | undefined => DATA.services.find(s => s.id === id);
export const planOf = (sid: string, pid: string): Plan | undefined => svcById(sid)?.plans.find(p => p.id === pid);
export const CATEGORY_LABEL: Record<string, string> = {
  host: 'Hosting', db: 'Database', auth: 'Auth', email: 'Email', media: 'Files and images', cache: 'Cache',
  payments: 'Payments', ai: 'AI', realtime: 'Realtime', monitoring: 'Monitoring', server: 'Server',
};
export const METRIC_LABEL: Record<string, string> = {
  bandwidthGB: 'bandwidth (GB/mo)', edgeRequests: 'edge requests/mo', fnInvocations: 'function calls/mo', cpuHours: 'active CPU hours/mo',
  memGBHours: 'function memory GB-hrs/mo', imageTransforms: 'image optimisations/mo', credits: 'credits/mo',
  dbComputeHours: 'compute hours/mo', dbStorageGB: 'database size (GB)', dbEgressGB: 'database egress (GB/mo)', mau: 'monthly active users',
  fileStorageGB: 'file storage (GB)', peakQps: 'peak queries/sec', fsReadsDay: 'document reads/day', fsWritesDay: 'document writes/day',
  emails: 'emails/mo', emailsDay: 'emails/day', mediaCredits: 'credits/mo', redisCommands: 'commands/mo',
  rtMessagesDay: 'messages/day', rtConcurrent: 'concurrent connections', errors: 'errors/mo', aiCallsDay: 'AI calls/day',
};

import type { Inputs } from './types';
import { DEFAULT_MIX } from './network';
// A typical Nigerian freelancer stack: Next.js on Vercel Hobby, Neon, Paystack, Resend, Cloudinary.
export const SAMPLE_PKG = {
  name: 'naija-shop', version: '0.1.0', private: true,
  dependencies: {
    next: '15.1.6', react: '19.0.0', 'react-dom': '19.0.0', '@neondatabase/serverless': '^0.10.4', 'drizzle-orm': '^0.38.3',
    'react-paystack': '^6.0.0', resend: '^4.1.1', 'next-cloudinary': '^6.16.0', 'next-auth': '4.24.7', zod: '^3.24.1', axios: '1.6.0',
  },
  devDependencies: { typescript: '^5.7.3', tailwindcss: '^3.4.17', eslint: '^9.18.0', 'drizzle-kit': '^0.30.1' },
};
export const DEFAULT_INPUTS: Inputs = {
  dau: 800, pagesPerUser: 6, pageWeightKB: 1400, requestsPerPage: 30, apiPerPage: 1.5, dbQueriesPerRequest: 3,
  uploadsPerDay: 40, uploadMB: 1.5, emailsPerDay: 60, aiCallsPerDay: 0, aiTokensIn: 800, aiTokensOut: 300,
  paymentsPerDay: 25, avgPaymentNgn: 12000, growthPct: 25, spikeMultiplier: 5, spikeDay: 1, horizon: 'days30',
  mix: { ...DEFAULT_MIX }, dauToMau: 3, imageShare: 0.55,
};

import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://statsrake.sites.tab.bot'),
  title: 'StatsRake: see the rake before it sees your face',
  description: 'StatsRake shows the day each free tier in your stack gives out, what it costs to stay up in dollars and naira, how it loads on 2G and 3G, and which packages have known vulnerabilities.',
  openGraph: { title: 'StatsRake', description: 'See the rake before it sees your face. Free-tier forecasts for indie and African devs.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'StatsRake', description: 'See the rake before it sees your face.', images: ['/og.png'] },
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f5f7fa' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}

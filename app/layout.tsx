import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://wahala.sites.tab.bot'),
  title: 'Wahala: stress-test your stack before launch',
  description: 'Paste your repo, pick your plans, simulate real Nigerian traffic and networks. See where your app breaks, what it will cost in naira and dollars, and better options.',
  openGraph: { title: 'Wahala', description: 'Give your app wahala before your users do.', images: ['/og.png'] },
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0c0f14' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}

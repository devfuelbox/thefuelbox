// Root Server Component layout — no 'use client' here
import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import QueryProvider from '@/components/providers/QueryProvider';
import { Suspense } from 'react';
import LayoutContent from '@/components/layout/LayoutContent';

// ── Self-hosted fonts via next/font — eliminates render-blocking Google Fonts request ──
// Fonts are downloaded at build time and served from the same origin
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-poppins',
  preload: true,
});

export const metadata: Metadata = {
  title: 'FuelBox - Personalized Meal Subscriptions & Nutrition Plans',
  description:
    'FuelBox delivers freshly cooked, high-protein, calorie-customized meal plans tailored to your fitness and health goals.',
  keywords: 'meal plan, high protein, diet food, health food, nutrition, fitness meals, Coimbatore',
  robots: 'index, follow',
  openGraph: {
    title: 'FuelBox - Personalized Meal Subscriptions',
    description: 'Macro-perfect, chef-prepared meals designed for your fitness goals.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#16A34A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <head>
        {/* ── DNS prefetch for external image CDN ── */}
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        {/* ── Hero image preload is handled automatically by <Image priority> ── */}
        {/* ── Google Fonts are now self-hosted via next/font — no external link needed ── */}
      </head>
      <body className="flex flex-col min-h-screen font-body text-gray-900 bg-gray-50">
        <QueryProvider>
          <Suspense
            fallback={
              <div className="min-h-screen bg-gray-50 flex items-center justify-center font-semibold text-gray-400">
                Loading FuelBox...
              </div>
            }
          >
            <LayoutContent>{children}</LayoutContent>
          </Suspense>
        </QueryProvider>
      </body>
    </html>
  );
}

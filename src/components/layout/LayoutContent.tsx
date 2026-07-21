'use client';

import Footer from '@/components/layout/Footer';
import BottomNav from '@/components/layout/BottomNav';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Lazy-load non-critical components to dramatically improve TBT & FCP
const AiBot = dynamic(() => import('@/views/AiBot'), { ssr: false });
const GlobalAdPopup = dynamic(
  () => import('@/components/advertisement/AdManager').then((m) => m.GlobalAdPopup),
  { ssr: false }
);
const GlobalAdNotification = dynamic(
  () => import('@/components/advertisement/AdManager').then((m) => m.GlobalAdNotification),
  { ssr: false }
);

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname ? pathname.startsWith('/admin') : false;

  return (
    <>
      <main className={`flex-grow ${!isAdmin ? 'pb-16 md:pb-0' : ''}`}>{children}</main>
      {!isAdmin && <Footer />}
      {!isAdmin && <BottomNav />}
      {!isAdmin && <GlobalAdNotification />}
      {!isAdmin && <GlobalAdPopup />}
      {!isAdmin && <AiBot />}
    </>
  );
}

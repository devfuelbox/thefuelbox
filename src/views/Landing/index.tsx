'use client';
import { lazy, Suspense } from 'react';
import HeroSection from './HeroSection';
import { AdManager } from '@/components/advertisement/AdManager';

// ── Lazy-load all below-fold sections — dramatically reduces TBT & TTI ──────
const HealthGoals = lazy(() => import('./HealthGoals'));
const FeaturedBoxes = lazy(() => import('./FeaturedBoxes'));
const NutritionHighlights = lazy(() => import('./NutritionHighlights'));
const HowItWorks = lazy(() => import('./HowItWorks'));
const MenuPreview = lazy(() => import('./MenuPreview'));
const AiAssistantPreview = lazy(() => import('./AiAssistantPreview'));
const RewardsPreview = lazy(() => import('./RewardsPreview'));
const CtaSection = lazy(() => import('./CtaSection'));

// Thin placeholder to prevent layout shift while lazy sections stream in
function SectionSkeleton() {
  return <div className="w-full h-64 bg-gray-50" aria-hidden="true" />;
}

export default function Landing() {
  return (
    <div className="flex flex-col min-h-screen">
      <AdManager />
      {/* Hero is above-fold — always render immediately */}
      <HeroSection />

      {/* Below-fold sections — deferred via React.lazy to unblock main thread */}
      <Suspense fallback={<SectionSkeleton />}>
        <HealthGoals />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <FeaturedBoxes />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <NutritionHighlights />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <HowItWorks />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <MenuPreview />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <AiAssistantPreview />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <RewardsPreview />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <CtaSection />
      </Suspense>
    </div>
  );
}

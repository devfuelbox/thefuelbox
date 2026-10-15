'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { pageTransition } from '@/lib/motion';

/**
 * Wraps route content with a short, calm enter transition on navigation.
 *
 * Deliberately has NO exit animation — the old page unmounts immediately so
 * navigation timing, scroll position and data fetching are untouched. Only the
 * incoming page fades/rises in. The `key` on the pathname restarts the motion
 * on every route change.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      variants={pageTransition}
      initial="hidden"
      animate="show"
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  );
}

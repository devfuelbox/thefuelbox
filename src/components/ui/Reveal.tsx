'use client';

import type { ReactNode, CSSProperties } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  fadeUp,
  staggerContainer,
  staggerItem,
  viewportOnce,
} from '@/lib/motion';

/**
 * Reusable motion building blocks.
 *
 * Everything here is deliberately thin: it wraps content in a Framer Motion
 * element with a shared variant, and quietly becomes a no-op when the user has
 * asked for reduced motion. No layout, spacing or styling is imposed, so these
 * can drop into any existing page without changing how it looks at rest.
 */

type MotionProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Seconds to wait before the reveal starts. */
  delay?: number;
  /** Fraction of the element that must be visible before it reveals. */
  amount?: number;
  variants?: Variants;
  as?: 'div' | 'section' | 'li' | 'article';
};

/**
 * Reveals its children once they scroll into view. Respects reduced motion by
 * simply rendering the children.
 */
export function Reveal({
  children,
  className,
  style,
  delay = 0,
  amount = 0.2,
  variants = fadeUp,
  as = 'div',
}: MotionProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  if (reduce) {
    const Tag = as as keyof JSX.IntrinsicElements;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnyTag = Tag as any;
    return (
      <AnyTag className={className} style={style}>
        {children}
      </AnyTag>
    );
  }

  return (
    <MotionTag
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ ...viewportOnce, amount }}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Wraps a list/grid so its direct `StaggerItem` children cascade in once the
 * group scrolls into view.
 */
export function StaggerGroup({
  children,
  className,
  style,
  amount = 0.15,
  as = 'div',
}: Omit<MotionProps, 'delay' | 'variants'>) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Tag = as as keyof JSX.IntrinsicElements;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnyTag = Tag as any;
    return (
      <AnyTag className={className} style={style}>
        {children}
      </AnyTag>
    );
  }
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      style={style}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ ...viewportOnce, amount }}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({ children, className, style, as = 'div' }: Omit<MotionProps, 'delay' | 'amount' | 'variants'>) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Tag = as as keyof JSX.IntrinsicElements;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnyTag = Tag as any;
    return (
      <AnyTag className={className} style={style}>
        {children}
      </AnyTag>
    );
  }
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag className={className} style={style} variants={staggerItem}>
      {children}
    </MotionTag>
  );
}

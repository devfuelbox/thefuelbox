import type { Variants, Transition } from 'framer-motion';

/**
 * Shared Framer Motion variants for FuelBox.
 *
 * One vocabulary of motion used across the whole app so every page, card and
 * list reveals with the same calm, premium cadence. All values are tuned to be
 * short, GPU-friendly (opacity + transform only) and consistent with the brand.
 */

export const EASE_OUT = [0.16, 0.8, 0.2, 1] as const;
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

export const DUR = {
  fast: 0.18,
  base: 0.4,
  slow: 0.6,
};

/** Fade + rise from below — the default reveal for a block of content. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE_OUT },
  },
};

/** Fade + drop from above — used for headers / toasts. */
export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: EASE_OUT },
  },
};

/** Simple opacity fade. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.base, ease: EASE_OUT } },
};

/** Gentle scale-in for cards, tiles and dialogs. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.base, ease: EASE_OUT },
  },
};

/** Slide in from the right — used for forward page/step changes. */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  show: { opacity: 1, x: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
  exit: { opacity: 0, x: -24, transition: { duration: DUR.fast, ease: EASE_IN_OUT } },
};

/** Slide in from the left — used for backward page/step changes. */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
  exit: { opacity: 0, x: 24, transition: { duration: DUR.fast, ease: EASE_IN_OUT } },
};

/**
 * Parent that staggers its children. Pair with `staggerItem` on each child and
 * a `staggerChildren` delay of ~0.06–0.09s for the premium cascade feel.
 */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

/** Child of `staggerContainer`. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
};

/** Page-level transition used by the route/step wrapper components. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: DUR.fast, ease: EASE_IN_OUT } },
};

/**
 * Standard viewport options for `whileInView` reveals: fire once, slightly
 * before the element is fully in view so the motion feels effortless.
 */
export const viewportOnce = { once: true, amount: 0.2 } as const;

/** Shared hover / tap feel for interactive surfaces. */
export const tapScale = { scale: 0.97 } as const;
export const hoverLift = { y: -2 } as const;

import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import React from 'react';

type AnimatedWrapperProps = {
  children: React.ReactNode;
  /** Optional direction for slide animation */
  direction?: 'left' | 'right' | 'up' | 'down' | 'default';
};

const variants: Record<string, Variants> = {
  left: { initial: { opacity: 0, x: -30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 } },
  right: { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 30 } },
  up: { initial: { opacity: 0, y: -30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -30 } },
  down: { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 30 } },
  default: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } },
};

export default function AnimatedWrapper({ children, direction = 'default' }: AnimatedWrapperProps) {
  const current = variants[direction] ?? variants['default'];
  return (
    <motion.div
      variants={current}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="motion-safe"
    >
      {children}
    </motion.div>
  );
}

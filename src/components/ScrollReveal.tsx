import type { ReactNode } from 'react'
import { useScrollReveal } from '@/hooks/useScrollReveal'

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  threshold?: number
}

export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
  duration = 0.6,
  threshold,
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal({ threshold })

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity ${duration}s ease-out ${delay}s, transform ${duration}s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
}

export default function Card({
  children,
  padding = 'md',
  hover = false,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl bg-white shadow-sm border border-gray-100 ${paddingStyles[padding]} ${hover ? 'transition-shadow duration-200 hover:shadow-md' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

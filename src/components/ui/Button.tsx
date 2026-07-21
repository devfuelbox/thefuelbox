import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import Spinner from './Spinner'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children: ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-energy-500 text-white hover:bg-energy-600 active:bg-energy-700 disabled:bg-energy-300',
  outline: 'border-2 border-brand-600 text-brand-600 hover:bg-brand-50 active:bg-brand-100 disabled:border-brand-300 disabled:text-brand-300',
  ghost: 'text-brand-600 hover:bg-brand-50 active:bg-brand-100 disabled:text-brand-300',
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-5 py-2.5 text-base gap-2',
  lg: 'px-7 py-3.5 text-lg gap-2.5',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={disabled || isLoading ? {} : { scale: 1.05 }}
      whileTap={disabled || isLoading ? {} : { scale: 0.95 }}
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Spinner size="sm" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </motion.button>
  )
}

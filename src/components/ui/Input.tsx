import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  variant?: 'default' | 'glass'
  className?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, helperText, variant = 'default', className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const baseClasses = `w-full rounded-lg border-2 px-4 py-2.5 text-base outline-none transition-colors duration-200 placeholder:text-gray-400 ${
      error
        ? 'border-red-500 focus:border-red-600'
        : 'border-gray-300 focus:border-brand-500'
    } disabled:cursor-not-allowed disabled:bg-gray-100 ${className}`
    const glassClasses = 'bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg'
    const finalClass = variant === 'glass' ? `${baseClasses} ${glassClasses}` : baseClasses

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={finalClass}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {helperText && !error && <p className="text-sm text-gray-500">{helperText}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
export default Input

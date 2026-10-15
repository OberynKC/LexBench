import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-8 w-full rounded-md border border-line-2 bg-field px-2.5 text-[13px] text-ink transition-colors',
        'placeholder:text-ink-4',
        'hover:border-line-3',
        'focus-visible:outline-none focus-visible:border-navy-400 focus-visible:ring-2 focus-visible:ring-navy-400/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-200',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

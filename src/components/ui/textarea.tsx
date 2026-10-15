import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-line-2 bg-field px-2.5 py-2 text-[13px] leading-relaxed text-ink transition-colors',
        'placeholder:text-ink-4',
        'hover:border-line-3',
        'focus-visible:outline-none focus-visible:border-navy-400 focus-visible:ring-2 focus-visible:ring-navy-400/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-red-400',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

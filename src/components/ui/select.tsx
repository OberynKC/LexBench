import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

/** 原生 select 的封装：与输入框共享高度、边框与焦点规则 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={cn(
          'h-8 w-full appearance-none rounded-md border border-line-2 bg-field pl-2.5 pr-7 text-[13px] text-ink transition-colors',
          'hover:border-line-3',
          'focus-visible:outline-none focus-visible:border-navy-400 focus-visible:ring-2 focus-visible:ring-navy-400/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
    </div>
  ),
)
Select.displayName = 'Select'

import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'amber' | 'red' | 'redSolid' | 'green' | 'blue' | 'gray'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-navy-800 text-white dark:bg-navy-700',
  secondary: 'bg-navy-50 text-navy-700 dark:bg-navy-900/50 dark:text-navy-200',
  outline: 'border border-line-2 text-ink-2',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900',
  redSolid: 'bg-red-600 text-white',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900',
  gray: 'bg-active text-ink-2',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

/** 状态标签：圆角小胶囊，11px 字重 medium，期限/风险语义色保持不变 */
export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 tnum',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-hover">
        <Icon className="h-5 w-5 text-ink-4" />
      </div>
      <p className="text-[13px] font-medium text-ink-2">{title}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed text-ink-3">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

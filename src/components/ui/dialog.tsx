import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/** 居中弹窗：标题区 / 内容区 / 操作区三段式，宽度由内容经 className 决定 */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-in absolute inset-0 bg-black/35 dark:bg-black/55" onClick={onClose} />
      <div
        role="dialog"
        className={cn(
          'relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-line-1 bg-surface shadow-pop',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-1 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1 text-xs leading-relaxed text-ink-3">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line-1 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

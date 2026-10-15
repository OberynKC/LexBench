import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/** 右侧滑出抽屉：标题区 / 滚动内容区 / 固定操作区，带遮罩与过渡 */
export function Drawer({ open, onClose, title, description, children, footer, width = 480 }: DrawerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn('absolute inset-0 bg-black/35 transition-opacity duration-200 dark:bg-black/55', visible ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        role="dialog"
        style={{ width, maxWidth: '100vw' }}
        className={cn(
          'absolute right-0 top-0 flex h-full flex-col border-l border-line-1 bg-surface shadow-pop transition-transform duration-200 ease-out',
          visible ? 'translate-x-0' : 'translate-x-full',
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
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line-1 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  )
}

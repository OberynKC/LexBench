import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

const TabsContext = createContext<{ value: string; onChange: (v: string) => void } | null>(null)

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  children: ReactNode
  className?: string
}) {
  const [inner, setInner] = useState(defaultValue ?? '')
  const current = value ?? inner
  const onChange = (v: string) => {
    setInner(v)
    onValueChange?.(v)
  }
  return (
    <TabsContext.Provider value={{ value: current, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-md bg-hover p-0.5', className)}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext)
  const active = ctx?.value === value
  return (
    <button
      type="button"
      onClick={() => ctx?.onChange(value)}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400',
        active
          ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]'
          : 'text-ink-3 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext)
  if (ctx?.value !== value) return null
  return <div className={className}>{children}</div>
}

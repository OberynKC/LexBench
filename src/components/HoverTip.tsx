import { useState, type ReactNode } from 'react'

interface HoverTipProps {
  /** 浮层内容 */
  tip: ReactNode
  children: ReactNode
  className?: string
}

/**
 * 轻量自定义悬停提示。
 * 背景：MiniCalendar / 日程表的事件标记都渲染在 <button> 格子内部，
 * Safari / Electron(WebKit) 中 button 后代元素的原生 title 提示不可靠（不弹出），
 * 因此这里用 fixed 定位的浮层实现（fixed 不受卡片 overflow-hidden 裁剪）。
 */
export function HoverTip({ tip, children, className }: HoverTipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  return (
    <span
      className={className}
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setPos({ x: Math.max(80, Math.min(r.left + r.width / 2, window.innerWidth - 80)), y: r.bottom + 6 })
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[100] -translate-x-1/2 rounded-md bg-gray-900/95 px-2.5 py-1.5 text-left text-[11px] leading-5 text-white shadow-lg dark:bg-gray-700"
          style={{ left: pos.x, top: pos.y }}
        >
          {tip}
        </span>
      )}
    </span>
  )
}

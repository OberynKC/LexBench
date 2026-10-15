import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent } from '../types'
import { cn, formatTime } from '../lib/utils'
import { buildMonthCells, eventTypeColor, weekDayNames } from '../lib/calendar'
import { HoverTip } from './HoverTip'

/** 色点模式下单格最多显示的圆点数，超出以「+N」收尾 */
const DOT_LIMIT = 5

interface MiniCalendarProps {
  month: Dayjs
  onMonthChange: (m: Dayjs) => void
  eventsByDay: Map<string, CalendarEvent[]>
}

/**
 * 微缩版月历（仪表盘用，日程表页的缩小版）：细灰格线，事件分两种标记——
 * 单条事件显示竖色条事件条（与日程表页一致），两条及以上显示一排彩色圆点；
 * 悬停均经 HoverTip 浮层展示完整时间与标题，点击某天跳转日程表页并定位到该日期。
 * 头部只有一行：左侧年月（跳 /calendar 的链接），右侧为 上月 / 今天 / 下月 控件。
 * 组件横向撑满父容器（格线直达卡片边缘），高度由父容器分配。
 */
export function MiniCalendar({ month, onMonthChange, eventsByDay }: MiniCalendarProps) {
  const navigate = useNavigate()
  const cells = useMemo(() => buildMonthCells(month), [month])
  const today = dayjs().format('YYYY-MM-DD')

  const goDay = (key: string) => navigate(`/calendar?date=${key}`)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 单行头部：年月链接 + 月份切换 */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
        <Link
          to="/calendar"
          className="tnum rounded px-1 text-[13px] font-semibold text-ink transition-colors hover:bg-hover hover:text-navy-700 dark:hover:text-navy-300"
          title="打开日程表"
        >
          {month.format('YYYY 年 M 月')}
        </Link>
        <div className="flex items-center gap-0.5">
          <button
            className="rounded p-1 text-ink-4 transition-colors hover:bg-hover hover:text-ink-2"
            onClick={() => onMonthChange(month.subtract(1, 'month'))}
            aria-label="上月"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="rounded px-1.5 py-0.5 text-xs text-navy-600 transition-colors hover:bg-navy-50 dark:text-navy-300 dark:hover:bg-navy-950"
            onClick={() => onMonthChange(dayjs().startOf('month'))}
          >
            今天
          </button>
          <button
            className="rounded p-1 text-ink-4 transition-colors hover:bg-hover hover:text-ink-2"
            onClick={() => onMonthChange(month.add(1, 'month'))}
            aria-label="下月"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 星期头（周日起） */}
      <div className="grid shrink-0 grid-cols-7 border-b border-line-1">
        {weekDayNames.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-ink-2">
            {d}
          </div>
        ))}
      </div>

      {/* 日期格：6×7 等分剩余高度，格线对齐日程表页风格 */}
      <div className="grid grid-cols-7 lg:min-h-0 lg:flex-1 lg:grid-rows-6">
        {cells.map((day) => {
          const key = day.format('YYYY-MM-DD')
          const dayEvents = eventsByDay.get(key) ?? []
          const inMonth = day.month() === month.month()
          const isToday = key === today
          return (
            <button
              key={key}
              onClick={() => goDay(key)}
              className={cn(
                'flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-r border-line-1 p-1.5 text-left transition-colors',
                '[&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0',
                inMonth ? 'bg-surface' : 'bg-hover',
                'hover:bg-navy-50/60 dark:hover:bg-navy-950/40',
              )}
            >
              {/* 日期号：右上角，今日为红色圆底 */}
              <span className="flex w-full items-start justify-end">
                {isToday ? (
                  <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                    {day.date()}
                  </span>
                ) : (
                  <span
                    className={cn(
                      'tnum text-[13px] font-medium leading-5',
                      inMonth ? 'text-ink' : 'text-ink-4',
                    )}
                  >
                    {day.date()}
                  </span>
                )}
              </span>
              {/* 事件标记：单条 = 事件条；多条 = 一排色点。均带 HoverTip，点击冒泡到格子跳日程页 */}
              {dayEvents.length === 1 ? (
                <HoverTip
                  tip={
                    <>
                      <span className="tnum text-gray-400">{formatTime(dayEvents[0].start)}</span> {dayEvents[0].title}
                    </>
                  }
                  className="flex w-full items-center gap-1 rounded-[3px] px-0.5 py-px"
                >
                  <span className={cn('h-3 w-[3px] shrink-0 rounded-full', eventTypeColor[dayEvents[0].type])} />
                  <span className="min-w-0 truncate text-[11px] leading-4 text-ink">{dayEvents[0].title}</span>
                  <span className="tnum ml-auto shrink-0 text-[10px] leading-4 text-ink-3">
                    {formatTime(dayEvents[0].start)}
                  </span>
                </HoverTip>
              ) : dayEvents.length > 1 ? (
                <span className="my-px flex h-4 w-full items-center gap-1 px-0.5">
                  {dayEvents.slice(0, DOT_LIMIT).map((e) => (
                    <HoverTip
                      key={e.id}
                      tip={
                        <>
                          <span className="tnum text-gray-400">{formatTime(e.start)}</span> {e.title}
                        </>
                      }
                      className="flex shrink-0 items-center"
                    >
                      <span className={cn('h-2 w-2 rounded-full', eventTypeColor[e.type])} />
                    </HoverTip>
                  ))}
                  {dayEvents.length > DOT_LIMIT && (
                    <span className="text-[9px] leading-none text-ink-3">+{dayEvents.length - DOT_LIMIT}</span>
                  )}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

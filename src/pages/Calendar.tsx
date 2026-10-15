import { showAlert } from '../lib/dialogs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react'
import { useStore } from '../store'
import type { CalendarEvent } from '../types'
import { cn, formatTime } from '../lib/utils'
import { buildMonthCells, eventTypeColor, getEventsOfDay, groupEventsByDay, weekDayNames } from '../lib/calendar'
import { lunarDayText } from '../lib/lunar'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Drawer } from '../components/ui/drawer'
import { EmptyState } from '../components/ui/empty-state'
import { EventTypeBadge } from '../components/badges'
import { EventDialog } from '../components/EventDialog'
import { HoverTip } from '../components/HoverTip'

/** 每格最多显示的事件行数，超出折叠为「+N 更多」 */
const CELL_EVENT_LIMIT = 3

export default function CalendarPage() {
  const { state, getCase } = useStore()
  const [month, setMonth] = useState(dayjs().startOf('month'))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [eventDialog, setEventDialog] = useState<{ open: boolean; date?: string; edit?: CalendarEvent }>({ open: false })
  const [searchParams, setSearchParams] = useSearchParams()
  const handledEditRef = useRef<string | null>(null)

  /** 点击日程标题：联动事件仅提示，手工事件打开编辑弹窗 */
  const handleEventTitleClick = useCallback((e: CalendarEvent) => {
    if (e.todoId) {
      void showAlert('该事件由待办事项自动同步，请在待办中修改')
      return
    }
    setEventDialog({ open: true, edit: e })
  }, [])

  // 支持日期定位与搜索编辑定位；消费参数后关闭弹窗不会再次打开。
  useEffect(() => {
    const edit = searchParams.get('edit')
    const date = searchParams.get('date')
    if (edit) {
      // StrictMode 会重复执行挂载 effect，联动事件的系统提示只显示一次。
      if (handledEditRef.current === edit) return
      handledEditRef.current = edit
      const event = state.events.find((value) => value.id === edit)
      if (event) {
        const target = dayjs(event.start)
        setMonth(target.startOf('month'))
        setSelectedDay(target.format('YYYY-MM-DD'))
        setEventDialog({ open: false })
        handleEventTitleClick(event)
      }
    } else {
      handledEditRef.current = null
    }
    if (!edit && date && dayjs(date).isValid()) {
      const target = dayjs(date)
      setMonth(target.startOf('month'))
      setSelectedDay(target.format('YYYY-MM-DD'))
    }
    if (edit || date) {
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      next.delete('date')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, state.events, handleEventTitleClick])

  // 日历格计算与事件分组统一走数据访问层（src/lib/calendar.ts）
  const cells = useMemo(() => buildMonthCells(month), [month])
  const eventsByDay = useMemo(() => groupEventsByDay(state.events), [state.events])

  const selectedEvents = selectedDay ? (eventsByDay.get(selectedDay) ?? []) : []
  const today = dayjs().format('YYYY-MM-DD')

  return (
    <div className="flex h-full flex-col p-5">
      {/* 头部：大号年月 + 分段控件 */}
      <div className="mb-3 flex shrink-0 items-end justify-between">
        <h2 className="tnum text-2xl font-semibold tracking-tight text-ink">
          {month.format('YYYY 年 M 月')}
        </h2>
        <div className="flex items-center gap-2">
          {/* 图例 */}
          <div className="hidden items-center gap-3 text-xs text-ink-3 xl:flex">
            {(Object.keys(eventTypeColor) as (keyof typeof eventTypeColor)[]).map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', eventTypeColor[t])} /> {t}
              </span>
            ))}
          </div>
          <Button size="sm" onClick={() => setEventDialog({ open: true })}>
            <Plus /> 新建日程
          </Button>
          {/* 分段控件：‹ ｜今天｜ ›，与 sm 按钮同高 */}
          <div className="flex h-7 items-stretch overflow-hidden rounded-md border border-line-2 bg-surface">
            <button
              className="flex items-center px-2 text-ink-3 transition-colors hover:bg-hover hover:text-ink"
              onClick={() => setMonth((m) => m.subtract(1, 'month'))}
              aria-label="上月"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              className="flex items-center border-x border-line-2 px-3 text-xs text-ink-2 transition-colors hover:bg-hover"
              onClick={() => setMonth(dayjs().startOf('month'))}
            >
              今天
            </button>
            <button
              className="flex items-center px-2 text-ink-3 transition-colors hover:bg-hover hover:text-ink"
              onClick={() => setMonth((m) => m.add(1, 'month'))}
              aria-label="下月"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 月视图：卡片面板（细边框、无阴影） */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line-1 bg-surface">
        {/* 星期表头（周日起） */}
        <div className="grid shrink-0 grid-cols-7 border-b border-line-2">
          {weekDayNames.map((d) => (
            <div key={d} className="py-1.5 text-center text-xs font-medium text-ink-3">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
          {cells.map((day) => {
            const key = day.format('YYYY-MM-DD')
            const dayEvents = getEventsOfDay(eventsByDay, day)
            const inMonth = day.month() === month.month()
            const isToday = key === today
            return (
              <button
                key={key}
                onClick={() => setSelectedDay(key)}
                className={cn(
                  'flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-r border-line-1 p-1.5 text-left transition-colors',
                  '[&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0',
                  inMonth ? 'bg-surface' : 'bg-hover',
                  'hover:bg-navy-50/60 dark:hover:bg-navy-950/40',
                )}
              >
                {/* 日期行：左侧农历小字，右侧公历日号 */}
                <span className="flex w-full items-start justify-between">
                  <span className="pt-0.5 text-[10px] leading-4 text-ink-4">
                    {lunarDayText(day)}
                  </span>
                  {isToday ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white tnum">
                      {day.date()}
                    </span>
                  ) : (
                    <span className={cn('text-xs tnum', inMonth ? 'text-ink' : 'text-ink-4')}>
                      {day.date()}
                      <span className="ml-px text-[9px] text-ink-4">日</span>
                    </span>
                  )}
                </span>
                {/* 事件行：竖色条 + 标题 + 等宽时间 */}
                <span className="flex w-full flex-col gap-0.5">
                  {dayEvents.slice(0, CELL_EVENT_LIMIT).map((e) => (
                    <HoverTip
                      key={e.id}
                      tip={
                        <>
                          <span className="tnum text-gray-400">{formatTime(e.start)}</span> {e.title}
                        </>
                      }
                      className="flex w-full items-center gap-1 rounded-[3px] px-0.5 py-px"
                    >
                      <span className={cn('h-3 w-[3px] shrink-0 rounded-full', eventTypeColor[e.type])} />
                      <span className="min-w-0 truncate text-[11px] leading-4 text-ink">{e.title}</span>
                      <span className="tnum ml-auto shrink-0 text-[10px] leading-4 text-ink-3">{formatTime(e.start)}</span>
                    </HoverTip>
                  ))}
                  {dayEvents.length > CELL_EVENT_LIMIT && (
                    <span className="px-0.5 text-[10px] font-medium text-navy-600 dark:text-navy-300">
                      +{dayEvents.length - CELL_EVENT_LIMIT} 更多
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 当日事件侧滑面板 */}
      <Drawer
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        width={420}
        title={selectedDay ? dayjs(selectedDay).format('M月D日') + ' ' + ['周日','周一','周二','周三','周四','周五','周六'][dayjs(selectedDay).day()] + ' 日程' : ''}
        footer={
          <Button
            onClick={() => {
              const date = selectedDay ?? undefined
              setSelectedDay(null)
              setEventDialog({ open: true, date })
            }}
          >
            <Plus /> 当日新建日程
          </Button>
        }
      >
        {selectedEvents.length === 0 ? (
          <EmptyState icon={CalendarDays} title="当日暂无日程" />
        ) : (
          <ul className="space-y-3">
            {selectedEvents.map((e) => {
              const c = e.caseId ? getCase(e.caseId) : undefined
              return (
                <li key={e.id}>
                  <Card>
                    <CardContent className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="tnum text-sm font-semibold text-ink">
                          {formatTime(e.start)} - {formatTime(e.end)}
                        </span>
                        <EventTypeBadge type={e.type} />
                      </div>
                      <p
                        onClick={() => handleEventTitleClick(e)}
                        className="cursor-pointer text-sm text-ink transition-colors hover:text-navy-600 hover:underline dark:hover:text-navy-300"
                      >
                        {e.title}
                      </p>
                      <div className="space-y-1 text-xs text-ink-3">
                        {e.location && (
                          <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-ink-4" />{e.location}</p>
                        )}
                        {c && (
                          <p>
                            关联案件：
                            <Link to={`/cases/${c.id}`} className="text-navy-600 hover:underline dark:text-navy-300" onClick={() => setSelectedDay(null)}>
                              {c.title}
                            </Link>
                          </p>
                        )}
                        {e.reminder && <p className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5 text-ink-4" />{e.reminder}</p>}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </Drawer>

      <EventDialog open={eventDialog.open} onClose={() => setEventDialog({ open: false })} defaultDate={eventDialog.date} event={eventDialog.edit} />
    </div>
  )
}

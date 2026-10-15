import { showAlert } from '../lib/dialogs'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { ArrowRight, ListTodo, MapPin, NotebookPen, Plus, ShieldAlert } from 'lucide-react'
import { useStore } from '../store'
import type { CalendarEvent, Preservation, Todo } from '../types'
import { cn, daysUntil, formatTime } from '../lib/utils'
import { groupEventsByDay, eventTypeColor } from '../lib/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'
import { DeadlineBadge } from '../components/badges'
import { CaseFormDrawer } from '../components/CaseFormDrawer'
import { EventDialog } from '../components/EventDialog'
import { TodoDialog } from '../components/TodoDialog'
import { PreservationDialog } from '../components/PreservationDialog'
import { MiniCalendar } from '../components/MiniCalendar'
import { TodoItem, sortTodos } from '../components/TodoItem'

/** 每张列表卡最多展示的条目数，超出以「查看全部」链接收尾，卡片内不出现滚动条 */
const LIST_LIMIT = 6

function CardLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return (
    <Link to={to} className={cn('transition-colors hover:text-navy-600 dark:hover:text-navy-300', className)}>
      {children}
    </Link>
  )
}

function ViewAllLink({ to, count }: { to: string; count: number }) {
  if (count <= LIST_LIMIT) return null
  return (
    <div className="mt-1 border-t border-line-1 pt-1.5 text-right">
      <Link to={to} className="inline-flex items-center gap-1 text-xs text-navy-600 hover:underline dark:text-navy-300">
        查看全部 {count} 条 <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

export default function Dashboard() {
  const { state, getCase } = useStore()
  const navigate = useNavigate()
  const [caseDrawerOpen, setCaseDrawerOpen] = useState(false)
  const [eventDialog, setEventDialog] = useState<{ open: boolean; edit?: CalendarEvent }>({ open: false })
  const [todoDialog, setTodoDialog] = useState<{ open: boolean; edit?: Todo }>({ open: false })
  const [preservationDialog, setPreservationDialog] = useState<{ open: boolean; edit?: Preservation }>({ open: false })
  const [miniMonth, setMiniMonth] = useState(dayjs().startOf('month'))

  /** 点击日程标题：联动事件仅提示，手工事件打开编辑弹窗 */
  const handleEventTitleClick = (e: CalendarEvent) => {
    if (e.todoId) {
      void showAlert('该事件由待办事项自动同步，请在待办中修改')
      return
    }
    setEventDialog({ open: true, edit: e })
  }

  const todayEvents = useMemo(
    () =>
      state.events
        .filter((e) => dayjs(e.start).isSame(dayjs(), 'day'))
        .sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf()),
    [state.events],
  )

  const deadlineAlerts = useMemo(
    () =>
      state.preservations
        // 到期预警只含未结束且已设定到期日的记录；申请阶段（尚无到期日）不进入倒计时
        .filter((p): p is Preservation & { deadline: string } => p.status !== '结束' && p.deadline !== null)
        .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline)),
    [state.preservations],
  )

  const pendingTodos = useMemo(() => sortTodos(state.todos).filter((t) => !t.done), [state.todos])
  const eventsByDay = useMemo(() => groupEventsByDay(state.events), [state.events])
  /** 红区待办：未完成且已逾期或 7 天内到期（与提醒中心口径一致） */
  const urgentTodos = useMemo(
    () => pendingTodos.filter((t) => t.deadline && daysUntil(t.deadline) <= 7).length,
    [pendingTodos],
  )

  const stats = [
    { label: '案件总数', value: state.cases.length, to: '/cases' },
    { label: '未完成待办', value: pendingTodos.length, to: '/todos' },
    { label: '7 天内及逾期待办', value: urgentTodos, to: '/todos', warn: urgentTodos > 0 },
    { label: '保全 / 执行预警', value: deadlineAlerts.length, to: '/preservations', warn: deadlineAlerts.length > 0 },
  ]

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-5">
      {/* 顶部一行：日期 + 快捷入口 */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-[15px] font-semibold text-ink">
          {dayjs().format('M月D日')} <span className="ml-1 text-[13px] font-normal text-ink-3">{['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs().day()]}</span>
        </h2>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTodoDialog({ open: true })}>
            <ListTodo /> 新建待办
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEventDialog({ open: true })}>
            <Plus /> 新建日程
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/notes', { state: { create: true } })}>
            <NotebookPen /> 新建笔记
          </Button>
          <Button size="sm" onClick={() => setCaseDrawerOpen(true)}>
            <Plus /> 新建案件
          </Button>
        </div>
      </div>

      {/* 统计条：核心数字一览，紧凑单行 */}
      <div className="flex shrink-0 items-center rounded-lg border border-line-1 bg-surface px-4 py-2.5">
        {stats.map((s, i) => (
          <div key={s.label} className={cn('flex items-baseline gap-2', i > 0 && 'ml-6 border-l border-line-1 pl-6')}>
            <span className="text-xs text-ink-3">{s.label}</span>
            <Link to={s.to} className={cn('tnum text-lg font-semibold transition-colors hover:text-navy-600 dark:hover:text-navy-300', s.warn ? 'text-red-600 dark:text-red-400' : 'text-ink')}>
              {s.value}
            </Link>
          </div>
        ))}
      </div>

      {/* 左列为待办与保全预警，右列为月历与今日日程；高度不足时滚动整个卡片区域。 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-2">
        {/* 左列：待办事项 + 保全 / 执行到期预警 */}
        {/* 两张卡预留六行条目与底部入口；短窗口由整列滚动，卡片内容保持完整。 */}
        <div className="flex min-h-0 flex-col gap-3 lg:min-h-[600px]">
          {/* 上：待办事项 */}
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="shrink-0 flex-row items-center justify-between space-y-0">
              <CardTitle>
                <CardLink to="/todos" className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-amber-500" /> 待办事项
                </CardLink>
              </CardTitle>
              <Badge variant="gray">{pendingTodos.length} 条未完成</Badge>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden py-2">
              {pendingTodos.length === 0 ? (
                <EmptyState icon={ListTodo} title="没有未完成的待办" className="py-4" />
              ) : (
                <>
                  <div className="divide-y divide-line-1">
                    {pendingTodos.slice(0, LIST_LIMIT).map((t) => (
                      <TodoItem key={t.id} todo={t} onEdit={(todo) => setTodoDialog({ open: true, edit: todo })} />
                    ))}
                  </div>
                  <ViewAllLink to="/todos" count={pendingTodos.length} />
                </>
              )}
            </CardContent>
          </Card>

          {/* 下：保全 / 执行到期预警 */}
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="shrink-0">
              <CardTitle>
                <CardLink to="/preservations" className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" /> 保全 / 执行到期预警
                </CardLink>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden py-2">
              {deadlineAlerts.length === 0 ? (
                <EmptyState icon={ShieldAlert} title="暂无待跟进的保全 / 执行事项" className="py-4" />
              ) : (
                <>
                  <ul className="space-y-1">
                    {deadlineAlerts.slice(0, LIST_LIMIT).map((p) => {
                      const c = getCase(p.caseId)
                      return (
                        <li
                          key={p.id}
                          onClick={() => setPreservationDialog({ open: true, edit: p })}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-1 transition-colors hover:bg-hover"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge variant="outline">{p.type}</Badge>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                setPreservationDialog({ open: true, edit: p })
                              }}
                              className="min-w-0 truncate text-left text-[13px] text-ink-2 hover:text-navy-700 hover:underline dark:hover:text-navy-300"
                            >
                              {c?.title ?? '未知案件'}
                            </button>
                            {c && (
                              <Link
                                to={`/cases/${c.id}`}
                                onClick={(ev) => ev.stopPropagation()}
                                className="shrink-0 text-xs text-ink-4 hover:text-navy-700 hover:underline dark:hover:text-navy-300"
                              >
                                查看案件
                              </Link>
                            )}
                          </div>
                          <DeadlineBadge deadline={p.deadline} />
                        </li>
                      )
                    })}
                  </ul>
                  <ViewAllLink to="/preservations" count={deadlineAlerts.length} />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右列：微缩月历（约 65% 高）+ 今日日程 合并为一张卡 */}
        <Card className="flex min-h-0 flex-col overflow-hidden lg:min-h-[600px]">
          <div className="flex min-h-0 flex-col lg:flex-[13]">
            <MiniCalendar month={miniMonth} onMonthChange={setMiniMonth} eventsByDay={eventsByDay} />
          </div>
          <div className="flex min-h-0 flex-col border-t border-line-1 lg:flex-[7]">
            <div className="shrink-0 px-4 pb-1 pt-2.5">
              <CardTitle>
                <CardLink to="/calendar">今日日程</CardLink>
              </CardTitle>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-4 pb-2">
              {todayEvents.length === 0 ? (
                <EmptyState title="今日暂无日程" className="py-4" />
              ) : (
                <>
                  <ol className="space-y-0.5">
                    {todayEvents.slice(0, LIST_LIMIT).map((e) => {
                      const c = e.caseId ? getCase(e.caseId) : undefined
                      return (
                        <li
                          key={e.id}
                          onClick={() => navigate('/calendar')}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-hover"
                        >
                          <span className="tnum w-[84px] shrink-0 text-xs font-medium text-ink-3">
                            {formatTime(e.start)}-{formatTime(e.end)}
                          </span>
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', eventTypeColor[e.type])} />
                          <span
                            onClick={(ev) => {
                              ev.stopPropagation()
                              handleEventTitleClick(e)
                            }}
                            className="min-w-0 cursor-pointer truncate text-[13px] font-medium text-ink transition-colors hover:text-navy-600 hover:underline dark:hover:text-navy-300"
                          >
                            {e.title}
                          </span>
                          <span className="ml-auto flex min-w-0 shrink items-center gap-2 text-xs text-ink-4">
                            {c && (
                              <Link
                                to={`/cases/${c.id}`}
                                onClick={(ev) => ev.stopPropagation()}
                                className="hidden max-w-[160px] truncate text-navy-600 hover:underline dark:text-navy-300 xl:inline"
                              >
                                {c.title}
                              </Link>
                            )}
                            {e.location && (
                              <span className="inline-flex max-w-[140px] items-center gap-1 truncate">
                                <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{e.location}</span>
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                  <ViewAllLink to="/calendar" count={todayEvents.length} />
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      <CaseFormDrawer open={caseDrawerOpen} onClose={() => setCaseDrawerOpen(false)} onSaved={(c) => navigate(`/cases/${c.id}`)} />
      <EventDialog open={eventDialog.open} onClose={() => setEventDialog({ open: false })} event={eventDialog.edit} />
      <TodoDialog open={todoDialog.open} onClose={() => setTodoDialog({ open: false })} todo={todoDialog.edit} />
      <PreservationDialog open={preservationDialog.open} onClose={() => setPreservationDialog({ open: false })} preservation={preservationDialog.edit} />
    </div>
  )
}

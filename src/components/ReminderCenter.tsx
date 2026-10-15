import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { cn } from '../lib/utils'
import { useStore } from '../store'
import { collectReminders, isRedReminder, type ReminderGroup } from '../lib/reminders'
import { formatDateTime } from '../lib/utils'
import { DeadlineBadge } from './badges'
import { Dialog } from './ui/dialog'

import { headerIconButtonClass } from './Layout'

const groups: { key: ReminderGroup; label: string }[] = [
  { key: 'overdue', label: '已逾期' }, { key: 'week', label: '7 天内' },
  { key: 'sixty', label: '60 天内' }, { key: 'later', label: '60 天后' },
  { key: 'events', label: '日程安排' },
]

export function ReminderCenter() {
  const { state, dispatch, readOnly } = useStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [clock, setClock] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const refresh = () => setClock((value) => value + 1)
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  const items = useMemo(() => collectReminders(state), [state.todos, state.preservations, state.events, state.cases, clock])
  const unseen = items.filter((item) => isRedReminder(item) && !state.reminderSeen.includes(item.fingerprint))
  const unseenKeys = JSON.stringify(unseen.map((item) => item.fingerprint))
  useEffect(() => {
    if (open && !readOnly && unseenKeys !== '[]') dispatch({ type: 'markRemindersSeen', payload: JSON.parse(unseenKeys) })
  }, [open, readOnly, unseenKeys, dispatch])
  const close = () => { setOpen(false); button.current?.focus() }
  const unread = state.reminderBadge ? unseen.length : 0
  return <>
    <button ref={button} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      aria-label={`期限提醒${unread ? `，${unread} 条未读` : ''}`} title="期限提醒"
      className={cn('relative', headerIconButtonClass)}>
      <Bell className="h-4 w-4" />
      {unread > 0 && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {createPortal(<Dialog open={open} onClose={close} title="期限提醒" description="期限来自手工录入；日程展示未来 30 天内开始的安排。" className="max-w-2xl">
      {readOnly && <p className="mb-3 text-xs text-amber-600">当前为只读状态，操作完成后自动保存已读记录。</p>}
      {items.length === 0 && <p className="py-8 text-center text-[13px] text-ink-3">暂无期限提醒或近期日程</p>}
      <div className="space-y-5">
        {groups.map((group) => {
          const rows = items.filter((item) => item.group === group.key)
          if (!rows.length) return null
          return <section key={group.key} aria-label={group.label}>
            <h3 className="mb-1.5 text-xs font-semibold text-ink-3">{group.label} <span className="ml-1 font-normal">{rows.length}</span></h3>
            <div className="divide-y divide-line-1">
              {rows.map((item) => <button type="button" key={item.itemKey} onClick={() => { close(); navigate(item.to) }}
                className="flex w-full items-center justify-between gap-4 rounded-md px-2.5 py-2.5 text-left hover:bg-hover focus-visible:ring-2 focus-visible:ring-navy-400">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-3">{item.secondary}</p>
                  {item.group === 'events' && <p className="mt-0.5 text-xs text-ink-3">{formatDateTime(item.deadline)}</p>}
                </div>
                <div className="shrink-0"><DeadlineBadge deadline={item.deadline} showDate={item.group !== 'events'} /></div>
              </button>)}
            </div>
          </section>
        })}
      </div>
    </Dialog>, document.body)}
  </>
}

import dayjs from 'dayjs'
import type { AppState } from '../types/api'
import { daysUntil } from './utils'

export type DeadlineBucket = 'overdue' | 'week' | 'sixty' | 'later'
export type ReminderGroup = DeadlineBucket | 'events'
export interface ReminderItem {
  itemKey: string
  fingerprint: string
  group: ReminderGroup
  title: string
  secondary: string
  deadline: string
  time: number
  to: string
}

export function deadlineBucket(days: number): DeadlineBucket {
  return days < 0 ? 'overdue' : days <= 7 ? 'week' : days <= 60 ? 'sixty' : 'later'
}
export function isRedReminder(item: ReminderItem): boolean {
  return item.group === 'overdue' || item.group === 'week'
}

/** 日期均来自用户录入；日程按开始时间筛选，待办与保全按本地自然日分级。 */
export function collectReminders(state: Pick<AppState, 'todos' | 'preservations' | 'events' | 'cases'>, now = dayjs()): ReminderItem[] {
  const cases = new Map(state.cases.map((value) => [value.id, value.title]))
  const caseName = (id: string | null) => (id ? cases.get(id) : undefined) ?? '未关联案件'
  const items: ReminderItem[] = []
  const add = (type: string, id: string, deadline: string, title: string, secondary: string, page: string) => {
    const group = deadlineBucket(daysUntil(deadline, now))
    const itemKey = `${type}:${id}:${deadline}`
    items.push({ itemKey, fingerprint: `${itemKey}:${group}`, group, title, secondary, deadline,
      time: dayjs(deadline).valueOf(), to: `/${page}?edit=${encodeURIComponent(id)}` })
  }
  for (const todo of state.todos) {
    if (!todo.done && todo.deadline) add('todo', todo.id, todo.deadline, todo.title, `待办 · ${caseName(todo.caseId)}`, 'todos')
  }
  for (const item of state.preservations) {
    if (item.status !== '结束' && item.deadline) add('preservation', item.id, item.deadline, caseName(item.caseId), `保全执行 · ${item.type}`, 'preservations')
  }
  for (const event of state.events) {
    const start = dayjs(event.start)
    if (start.valueOf() < now.valueOf() || start.valueOf() > now.add(30, 'day').valueOf()) continue
    const itemKey = `event:${event.id}:${start.format('YYYY-MM-DD')}`
    items.push({ itemKey, fingerprint: itemKey, group: 'events', title: event.title,
      secondary: `${event.type} · ${caseName(event.caseId)}`, deadline: event.start, time: start.valueOf(),
      to: `/calendar?edit=${encodeURIComponent(event.id)}` })
  }
  return items.sort((a, b) => a.time - b.time || a.itemKey.localeCompare(b.itemKey))
}

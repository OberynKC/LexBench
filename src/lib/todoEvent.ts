import dayjs from 'dayjs'
import type { CalendarEvent, Todo } from '../types'

export function todoEventId(todoId: string): string {
  return `todo_event_${todoId}`
}

export function buildTodoEvent(todo: Todo, existingId?: string): CalendarEvent {
  if (!todo.deadline) throw new Error('无期限待办不能生成截止期限事件')

  const start = dayjs(`${todo.deadline}T09:00:00`)
  const end = dayjs(`${todo.deadline}T10:00:00`)
  if (!start.isValid() || !end.isValid()) throw new Error('待办期限格式无效')

  return {
    id: existingId ?? todoEventId(todo.id),
    title: todo.done ? `已完成：${todo.title}` : todo.title,
    type: '截止期限',
    caseId: todo.caseId,
    start: start.toISOString(),
    end: end.toISOString(),
    location: '',
    reminder: '当天 09:00',
    todoId: todo.id,
  }
}

export function syncTodoEvents(events: CalendarEvent[], todo: Todo): CalendarEvent[] {
  const existing = events.find((event) => event.todoId === todo.id)
  if (!todo.deadline) {
    return existing ? events.filter((event) => event.todoId !== todo.id) : events
  }
  if (existing) {
    return events.map((event) => (event.todoId === todo.id ? buildTodoEvent(todo, event.id) : event))
  }
  return [...events, buildTodoEvent(todo)]
}

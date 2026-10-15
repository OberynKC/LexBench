import type Database from 'better-sqlite3'
import type { CalendarEvent } from '../../../src/types'
import { mapEvent, normalizeTimestamp, type EventRow } from '../mappers'
import { assertOne } from './common'

export function listEvents(db: Database.Database): CalendarEvent[] {
  return db.prepare<[], EventRow>('SELECT * FROM calendar_events ORDER BY rowid DESC').all().map(mapEvent)
}

export function createEvent(db: Database.Database, value: CalendarEvent): void {
  const result = db.prepare(`
    INSERT INTO calendar_events (
      id, title, type, case_id, starts_at, ends_at, location, reminder, todo_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    value.id,
    value.title,
    value.type,
    value.caseId,
    normalizeTimestamp(value.start),
    normalizeTimestamp(value.end),
    value.location,
    value.reminder,
    value.todoId ?? null,
  )
  assertOne(result)
}

export function upsertEvent(db: Database.Database, value: CalendarEvent): void {
  const result = db.prepare(`
    INSERT INTO calendar_events (
      id, title, type, case_id, starts_at, ends_at, location, reminder, todo_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      case_id = excluded.case_id,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      location = excluded.location,
      reminder = excluded.reminder,
      todo_id = excluded.todo_id
  `).run(
    value.id,
    value.title,
    value.type,
    value.caseId,
    normalizeTimestamp(value.start),
    normalizeTimestamp(value.end),
    value.location,
    value.reminder,
    value.todoId ?? null,
  )
  assertOne(result)
}

export function findEventByTodoId(db: Database.Database, todoId: string): CalendarEvent | undefined {
  const row = db.prepare<[string], EventRow>('SELECT * FROM calendar_events WHERE todo_id = ?').get(todoId)
  return row ? mapEvent(row) : undefined
}

export function deleteEventByTodoId(db: Database.Database, todoId: string): void {
  db.prepare('DELETE FROM calendar_events WHERE todo_id = ?').run(todoId)
}

/** 联动事件（由待办自动同步，带 todo_id）不允许手工编辑/删除；此处做数据库层兜底 */
function assertManualEditable(db: Database.Database, id: string): void {
  const row = db.prepare<[string], { todo_id: string | null }>(
    'SELECT todo_id FROM calendar_events WHERE id = ?',
  ).get(id)
  if (!row) throw new Error('目标记录不存在')
  if (row.todo_id !== null) throw new Error('该事件由待办事项自动同步，请在待办中修改')
}

export function updateEvent(db: Database.Database, value: CalendarEvent): void {
  assertManualEditable(db, value.id)
  const result = db.prepare(`
    UPDATE calendar_events
    SET title = ?, type = ?, case_id = ?, starts_at = ?, ends_at = ?, location = ?, reminder = ?, todo_id = ?
    WHERE id = ?
  `).run(
    value.title,
    value.type,
    value.caseId,
    normalizeTimestamp(value.start),
    normalizeTimestamp(value.end),
    value.location,
    value.reminder,
    value.todoId ?? null,
    value.id,
  )
  assertOne(result)
}

export function deleteEvent(db: Database.Database, id: string): void {
  assertManualEditable(db, id)
  assertOne(db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id))
}

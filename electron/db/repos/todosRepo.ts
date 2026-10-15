import type Database from 'better-sqlite3'
import type { Todo } from '../../../src/types'
import { mapTodo, normalizeDate, normalizeTimestamp, type TodoRow } from '../mappers'
import { assertOne } from './common'

export function listTodos(db: Database.Database): Todo[] {
  return db.prepare<[], TodoRow>('SELECT * FROM todos ORDER BY rowid DESC').all().map(mapTodo)
}

export function createTodo(db: Database.Database, value: Todo): void {
  const result = db.prepare(`
    INSERT INTO todos (id, title, case_id, done, deadline, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    value.id,
    value.title,
    value.caseId,
    value.done ? 1 : 0,
    value.deadline === null ? null : normalizeDate(value.deadline),
    normalizeTimestamp(value.createdAt),
  )
  assertOne(result)
}

export function updateTodo(db: Database.Database, value: Todo): void {
  const result = db.prepare(`
    UPDATE todos
    SET title = ?, case_id = ?, done = ?, deadline = ?, created_at = ?
    WHERE id = ?
  `).run(
    value.title,
    value.caseId,
    value.done ? 1 : 0,
    value.deadline === null ? null : normalizeDate(value.deadline),
    normalizeTimestamp(value.createdAt),
    value.id,
  )
  assertOne(result)
}

export function deleteTodo(db: Database.Database, id: string): void {
  assertOne(db.prepare('DELETE FROM todos WHERE id = ?').run(id))
}

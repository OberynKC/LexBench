import type Database from 'better-sqlite3'
import type { Todo } from '../../../src/types'
import { buildTodoEvent } from '../../../src/lib/todoEvent'
import { deleteEventByTodoId, findEventByTodoId, upsertEvent } from '../repos/eventsRepo'
import { createTodo as createTodoRow, deleteTodo, updateTodo as updateTodoRow } from '../repos/todosRepo'

function syncEvent(db: Database.Database, value: Todo): void {
  const existing = findEventByTodoId(db, value.id)
  if (!value.deadline) {
    deleteEventByTodoId(db, value.id)
    return
  }
  upsertEvent(db, buildTodoEvent(value, existing?.id))
}

export function createTodo(db: Database.Database, value: Todo): void {
  db.transaction(() => {
    createTodoRow(db, value)
    syncEvent(db, value)
  })()
}

export function updateTodo(db: Database.Database, value: Todo): void {
  db.transaction(() => {
    const existing = findEventByTodoId(db, value.id)
    updateTodoRow(db, value)
    if (!value.deadline) {
      deleteEventByTodoId(db, value.id)
    } else {
      upsertEvent(db, buildTodoEvent(value, existing?.id))
    }
  })()
}

export function removeTodo(db: Database.Database, id: string): void {
  db.transaction(() => deleteTodo(db, id))()
}

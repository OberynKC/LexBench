import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type { Note } from '../../../src/types'
import {
  createNote as createNoteRow, updateNote as updateNoteRow, getNote,
  createVersion, deleteDraft, listVersions, pruneVersions,
} from '../repos/notesRepo'

export function createNote(db: Database.Database, value: Note, clearNewDraft = false): void {
  db.transaction(() => {
    createNoteRow(db, value)
    // 历史副本也复用创建链路；仅编辑器提交新建草稿时清理 __new__。
    if (clearNewDraft) deleteDraft(db, '__new__')
  })()
}

export function updateNote(db: Database.Database, value: Note): void {
  db.transaction(() => {
    const original = getNote(db, value.id)
    const snapshot = (note: Note) => createVersion(db, {
      id: randomUUID(), noteId: note.id, title: note.title, content: note.content,
      tags: note.tags, createdAt: note.updatedAt,
    })
    if (listVersions(db, value.id).length === 0) snapshot(original)
    updateNoteRow(db, value)
    snapshot(value)
    pruneVersions(db, value.id)
    deleteDraft(db, value.id)
  })()
}

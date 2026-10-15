import type Database from 'better-sqlite3'
import type { Note, NoteDraft, NoteDraftInput, NoteVersion } from '../../../src/types'
import { mapNote, mapNoteDraft, mapNoteVersion, normalizeTimestamp, type NoteRow, type NoteDraftRow, type NoteVersionRow } from '../mappers'
import { assertOne } from './common'

export function listNotes(db: Database.Database): Note[] {
  return db.prepare<[], NoteRow>('SELECT * FROM notes ORDER BY rowid DESC').all().map(mapNote)
}

export function createNote(db: Database.Database, value: Note): void {
  const result = db.prepare(`
    INSERT INTO notes (id, case_id, title, content, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    value.id,
    value.caseId,
    value.title,
    value.content,
    JSON.stringify(value.tags),
    normalizeTimestamp(value.createdAt),
    normalizeTimestamp(value.updatedAt),
  )
  assertOne(result)
}

export function updateNote(db: Database.Database, value: Note): void {
  const result = db.prepare(`
    UPDATE notes
    SET case_id = ?, title = ?, content = ?, tags_json = ?, created_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    value.caseId,
    value.title,
    value.content,
    JSON.stringify(value.tags),
    normalizeTimestamp(value.createdAt),
    normalizeTimestamp(value.updatedAt),
    value.id,
  )
  assertOne(result)
}

export function deleteNote(db: Database.Database, id: string): void {
  assertOne(db.prepare('DELETE FROM notes WHERE id = ?').run(id))
}

export function getNote(db: Database.Database, id: string): Note {
  const row = db.prepare<[string], NoteRow>('SELECT * FROM notes WHERE id = ?').get(id)
  if (!row) throw new Error('笔记已不存在')
  return mapNote(row)
}

export function listVersions(db: Database.Database, noteId: string): NoteVersion[] {
  return db.prepare<[string], NoteVersionRow>(`
    SELECT * FROM note_versions WHERE note_id = ? ORDER BY created_at DESC, rowid DESC
  `).all(noteId).map(mapNoteVersion)
}

export function getVersion(db: Database.Database, id: string): NoteVersion | null {
  const row = db.prepare<[string], NoteVersionRow>('SELECT * FROM note_versions WHERE id = ?').get(id)
  return row ? mapNoteVersion(row) : null
}

export function createVersion(db: Database.Database, value: NoteVersion): void {
  db.prepare(`INSERT INTO note_versions (id, note_id, title, content, tags_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(value.id, value.noteId, value.title, value.content,
    JSON.stringify(value.tags), normalizeTimestamp(value.createdAt))
}

export function pruneVersions(db: Database.Database, noteId: string): void {
  // 按写入顺序保留最近 20 次快照，同毫秒保存也有确定的次序。
  db.prepare(`DELETE FROM note_versions WHERE note_id = ? AND id NOT IN (
    SELECT id FROM note_versions WHERE note_id = ? ORDER BY rowid DESC LIMIT 20
  )`).run(noteId, noteId)
}

export function saveDraft(db: Database.Database, value: NoteDraftInput): NoteDraft {
  const draft: NoteDraft = { ...value, savedAt: new Date().toISOString() }
  db.prepare(`INSERT INTO note_drafts (note_id, case_id, title, content, tags_json, saved_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(note_id) DO UPDATE SET
    case_id = excluded.case_id, title = excluded.title, content = excluded.content,
    tags_json = excluded.tags_json, saved_at = excluded.saved_at
  `).run(draft.noteId, draft.caseId || null, draft.title, draft.content, JSON.stringify(draft.tags), draft.savedAt)
  return draft
}

export function getDraft(db: Database.Database, noteId: string): NoteDraft | null {
  const row = db.prepare<[string], NoteDraftRow>('SELECT * FROM note_drafts WHERE note_id = ?').get(noteId)
  return row ? mapNoteDraft(row) : null
}

export function deleteDraft(db: Database.Database, noteId: string): void {
  db.prepare('DELETE FROM note_drafts WHERE note_id = ?').run(noteId)
}

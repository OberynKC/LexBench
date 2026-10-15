import type Database from 'better-sqlite3'
import type { Preservation } from '../../../src/types'
import { mapPreservation, normalizeDate, type PreservationRow } from '../mappers'
import { assertOne } from './common'

export function listPreservations(db: Database.Database): Preservation[] {
  return db.prepare<[], PreservationRow>('SELECT * FROM preservations ORDER BY rowid DESC').all().map(mapPreservation)
}

export function createPreservation(db: Database.Database, value: Preservation): void {
  const result = db.prepare(`
    INSERT INTO preservations (id, case_id, type, deadline, status, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    value.id,
    value.caseId,
    value.type,
    value.deadline === null ? null : normalizeDate(value.deadline),
    value.status,
    value.note,
  )
  assertOne(result)
}

export function updatePreservation(db: Database.Database, value: Preservation): void {
  const result = db.prepare(`
    UPDATE preservations
    SET case_id = ?, type = ?, deadline = ?, status = ?, note = ?
    WHERE id = ?
  `).run(
    value.caseId,
    value.type,
    value.deadline === null ? null : normalizeDate(value.deadline),
    value.status,
    value.note,
    value.id,
  )
  assertOne(result)
}

import type Database from 'better-sqlite3'
import type { Case } from '../../../src/types'
import { normalizeDate, toCents, type CaseRow } from '../mappers'
import { assertOne } from './common'

export interface CaseRelationRow {
  case_id: string
  related_case_id: string
  sort_order: number
}

export function listCaseRows(db: Database.Database): CaseRow[] {
  return db.prepare<[], CaseRow>('SELECT * FROM cases ORDER BY rowid DESC').all()
}

export function listCaseRelationRows(db: Database.Database): CaseRelationRow[] {
  return db.prepare<[], CaseRelationRow>(`
    SELECT case_id, related_case_id, sort_order
    FROM case_related
    ORDER BY case_id, sort_order
  `).all()
}

export function createCase(db: Database.Database, value: Case): void {
  const result = db.prepare(`
    INSERT INTO cases (
      id, case_number, title, type, template_id, stage_id, side, client_id,
      opposing_party, court, judge, judge_phone, amount_cents,
      accepted_at, next_deadline, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    value.id,
    value.caseNumber ?? null,
    value.title,
    value.type,
    value.templateId,
    value.stageId,
    value.side,
    value.clientId,
    value.opposingParty,
    value.court,
    value.judge,
    value.judgePhone,
    toCents(value.amount),
    normalizeDate(value.acceptedAt),
    normalizeDate(value.nextDeadline),
    value.note,
  )
  assertOne(result)
}

export function updateCase(db: Database.Database, value: Case): void {
  const result = db.prepare(`
    UPDATE cases
    SET case_number = ?, title = ?, type = ?, template_id = ?, stage_id = ?, side = ?,
        client_id = ?, opposing_party = ?, court = ?, judge = ?, judge_phone = ?,
        amount_cents = ?, accepted_at = ?, next_deadline = ?, note = ?
    WHERE id = ?
  `).run(
    value.caseNumber ?? null,
    value.title,
    value.type,
    value.templateId,
    value.stageId,
    value.side,
    value.clientId,
    value.opposingParty,
    value.court,
    value.judge,
    value.judgePhone,
    toCents(value.amount),
    normalizeDate(value.acceptedAt),
    normalizeDate(value.nextDeadline),
    value.note,
    value.id,
  )
  assertOne(result)
}

export function deleteCaseRelations(db: Database.Database, caseId: string): void {
  db.prepare('DELETE FROM case_related WHERE case_id = ?').run(caseId)
}

export function createCaseRelation(
  db: Database.Database,
  caseId: string,
  relatedCaseId: string,
  sortOrder: number,
): void {
  const result = db.prepare(`
    INSERT INTO case_related (case_id, related_case_id, sort_order)
    VALUES (?, ?, ?)
  `).run(caseId, relatedCaseId, sortOrder)
  assertOne(result)
}

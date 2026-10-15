import type Database from 'better-sqlite3'
import type { FeeRecord } from '../../../src/types'
import { mapFee, normalizeDate, toCents, type FeeRow } from '../mappers'
import { assertOne } from './common'

export function listFees(db: Database.Database): FeeRecord[] {
  return db.prepare<[], FeeRow>('SELECT * FROM fee_records ORDER BY rowid DESC').all().map(mapFee)
}

export function createFee(db: Database.Database, value: FeeRecord): void {
  const result = db.prepare(`
    INSERT INTO fee_records (
      id, contract_id, label, amount_cents, due_date, received_amount_cents, received_at, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    value.id,
    value.contractId,
    value.label,
    toCents(value.amount),
    normalizeDate(value.dueDate),
    toCents(value.receivedAmount),
    normalizeDate(value.receivedAt, true),
    value.note,
  )
  assertOne(result)
}

export function updateFee(db: Database.Database, value: FeeRecord): void {
  const result = db.prepare(`
    UPDATE fee_records
    SET contract_id = ?, label = ?, amount_cents = ?, due_date = ?,
        received_amount_cents = ?, received_at = ?, note = ?
    WHERE id = ?
  `).run(
    value.contractId,
    value.label,
    toCents(value.amount),
    normalizeDate(value.dueDate),
    toCents(value.receivedAmount),
    normalizeDate(value.receivedAt, true),
    value.note,
    value.id,
  )
  assertOne(result)
}

export function deleteFee(db: Database.Database, id: string): void {
  assertOne(db.prepare('DELETE FROM fee_records WHERE id = ?').run(id))
}

import type Database from 'better-sqlite3'
import type { Contract } from '../../../src/types'
import { normalizeDate, toCents, type ContractRow } from '../mappers'
import { assertOne } from './common'

export interface ContractCaseRow {
  contract_id: string
  case_id: string
  sort_order: number
}

export function listContractRows(db: Database.Database): ContractRow[] {
  return db.prepare<[], ContractRow>('SELECT * FROM contracts ORDER BY rowid DESC').all()
}

export function listContractCaseRows(db: Database.Database): ContractCaseRow[] {
  return db.prepare<[], ContractCaseRow>(`
    SELECT contract_id, case_id, sort_order
    FROM contract_cases
    ORDER BY contract_id, sort_order
  `).all()
}

export function createContract(db: Database.Database, value: Contract): void {
  const result = db.prepare(`
    INSERT INTO contracts (
      id, contract_no, client_id, signed_at, fee_mode, total_fee_cents, status, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    value.id,
    value.contractNo,
    value.clientId,
    normalizeDate(value.signedAt),
    value.feeMode,
    toCents(value.totalFee),
    value.status,
    value.note,
  )
  assertOne(result)
}

export function updateContract(db: Database.Database, value: Contract): void {
  const result = db.prepare(`
    UPDATE contracts
    SET contract_no = ?, client_id = ?, signed_at = ?, fee_mode = ?,
        total_fee_cents = ?, status = ?, note = ?
    WHERE id = ?
  `).run(
    value.contractNo,
    value.clientId,
    normalizeDate(value.signedAt),
    value.feeMode,
    toCents(value.totalFee),
    value.status,
    value.note,
    value.id,
  )
  assertOne(result)
}

export function deleteContract(db: Database.Database, id: string): void {
  assertOne(db.prepare('DELETE FROM contracts WHERE id = ?').run(id))
}

export function deleteContractCases(db: Database.Database, contractId: string): void {
  db.prepare('DELETE FROM contract_cases WHERE contract_id = ?').run(contractId)
}

export function createContractCase(db: Database.Database, contractId: string, caseId: string, sortOrder: number): void {
  const result = db.prepare(`
    INSERT INTO contract_cases (contract_id, case_id, sort_order)
    VALUES (?, ?, ?)
  `).run(contractId, caseId, sortOrder)
  assertOne(result)
}

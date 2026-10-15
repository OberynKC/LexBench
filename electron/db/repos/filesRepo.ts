import type Database from 'better-sqlite3'
import type { FileMeta, FileOwner } from '../../../src/types'
import { normalizeTimestamp, type FileRow } from '../mappers'
import { assertOne } from './common'

export function listFileRows(db: Database.Database): FileRow[] {
  return db.prepare<[], FileRow>(`
    SELECT id, contract_id, invoice_id, case_id, name, stored_name, rel_path, size, uploaded_at, sort_order
    FROM file_meta
    ORDER BY COALESCE(contract_id, invoice_id, case_id), sort_order
  `).all()
}

export function findFileRow(db: Database.Database, id: string): FileRow | undefined {
  return db.prepare<[string], FileRow>(`
    SELECT id, contract_id, invoice_id, case_id, name, stored_name, rel_path, size, uploaded_at, sort_order
    FROM file_meta
    WHERE id = ?
  `).get(id)
}

export function deleteFile(db: Database.Database, id: string): void {
  assertOne(db.prepare('DELETE FROM file_meta WHERE id = ?').run(id))
}

export function nextFileSortOrder(db: Database.Database, owner: FileOwner): number {
  let row: { next_order: number } | undefined
  if (owner.type === 'contract') {
    row = db.prepare<[string], { next_order: number }>(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM file_meta WHERE contract_id = ?
    `).get(owner.id)
  } else if (owner.type === 'invoice') {
    row = db.prepare<[string], { next_order: number }>(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM file_meta WHERE invoice_id = ?
    `).get(owner.id)
  } else {
    row = db.prepare<[string], { next_order: number }>(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM file_meta WHERE case_id = ?
    `).get(owner.id)
  }
  return row?.next_order ?? 0
}

export function createOwnedFile(
  db: Database.Database,
  owner: FileOwner,
  value: FileMeta,
  sortOrder: number,
): void {
  let result: Database.RunResult
  if (owner.type === 'contract') {
    result = db.prepare(`
      INSERT INTO file_meta (
        id, contract_id, invoice_id, case_id, name, stored_name, rel_path, size, uploaded_at, sort_order
      ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id,
      owner.id,
      value.name,
      value.storedName,
      value.relPath,
      value.size,
      normalizeTimestamp(value.uploadedAt),
      sortOrder,
    )
  } else if (owner.type === 'invoice') {
    result = db.prepare(`
      INSERT INTO file_meta (
        id, contract_id, invoice_id, case_id, name, stored_name, rel_path, size, uploaded_at, sort_order
      ) VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id,
      owner.id,
      value.name,
      value.storedName,
      value.relPath,
      value.size,
      normalizeTimestamp(value.uploadedAt),
      sortOrder,
    )
  } else {
    result = db.prepare(`
      INSERT INTO file_meta (
        id, contract_id, invoice_id, case_id, name, stored_name, rel_path, size, uploaded_at, sort_order
      ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id,
      owner.id,
      value.name,
      value.storedName,
      value.relPath,
      value.size,
      normalizeTimestamp(value.uploadedAt),
      sortOrder,
    )
  }
  assertOne(result)
}

export function createContractFile(
  db: Database.Database,
  contractId: string,
  value: FileMeta,
  sortOrder: number,
): void {
  createOwnedFile(db, { type: 'contract', id: contractId }, value, sortOrder)
}

export function createInvoiceFile(
  db: Database.Database,
  invoiceId: string,
  value: FileMeta,
  sortOrder: number,
): void {
  createOwnedFile(db, { type: 'invoice', id: invoiceId }, value, sortOrder)
}

import type Database from 'better-sqlite3'
import type { Invoice } from '../../../src/types'
import { normalizeDate, toCents, type InvoiceRow } from '../mappers'
import { assertOne } from './common'

export function listInvoiceRows(db: Database.Database): InvoiceRow[] {
  return db.prepare<[], InvoiceRow>('SELECT * FROM invoices ORDER BY rowid DESC').all()
}

export function createInvoice(db: Database.Database, value: Invoice): void {
  const result = db.prepare(`
    INSERT INTO invoices (id, contract_id, invoice_no, kind, amount_cents, issued_at, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    value.id,
    value.contractId,
    value.invoiceNo,
    value.kind,
    toCents(value.amount),
    normalizeDate(value.issuedAt),
    value.note,
  )
  assertOne(result)
}

export function updateInvoice(db: Database.Database, value: Invoice): void {
  const result = db.prepare(`
    UPDATE invoices
    SET contract_id = ?, invoice_no = ?, kind = ?, amount_cents = ?, issued_at = ?, note = ?
    WHERE id = ?
  `).run(
    value.contractId,
    value.invoiceNo,
    value.kind,
    toCents(value.amount),
    normalizeDate(value.issuedAt),
    value.note,
    value.id,
  )
  assertOne(result)
}

export function deleteInvoice(db: Database.Database, id: string): void {
  assertOne(db.prepare('DELETE FROM invoices WHERE id = ?').run(id))
}

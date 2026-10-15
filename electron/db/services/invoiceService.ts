import { assertWritable } from '../../export/exportGate'
import type Database from 'better-sqlite3'
import type { Invoice } from '../../../src/types'
import { createInvoice as createInvoiceRow, deleteInvoice, updateInvoice as updateInvoiceRow } from '../repos/invoicesRepo'
import { attachmentsRootForDatabase, removeOwnerDirectory } from '../../files/attachmentStorage'

export function createInvoice(db: Database.Database, value: Invoice): void {
  db.transaction(() => {
    createInvoiceRow(db, value)
  })()
}

export function updateInvoice(db: Database.Database, value: Invoice): void {
  db.transaction(() => {
    updateInvoiceRow(db, value)
  })()
}

export function removeInvoice(db: Database.Database, id: string): void {
  assertWritable(db)
  db.transaction(() => deleteInvoice(db, id))()
  removeOwnerDirectory(attachmentsRootForDatabase(db), { type: 'invoice', id })
}

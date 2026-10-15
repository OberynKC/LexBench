import { assertWritable } from '../../export/exportGate'
import type Database from 'better-sqlite3'
import type { Contract } from '../../../src/types'
import {
  createContract as createContractRow,
  createContractCase,
  deleteContract as deleteContractRow,
  deleteContractCases,
  updateContract as updateContractRow,
} from '../repos/contractsRepo'
import { removeOwnerDirectory, attachmentsRootForDatabase } from '../../files/attachmentStorage'

function replaceNestedData(db: Database.Database, value: Contract): void {
  deleteContractCases(db, value.id)
  value.caseIds.forEach((caseId, index) => createContractCase(db, value.id, caseId, index))
}

export function createContract(db: Database.Database, value: Contract): void {
  db.transaction(() => {
    createContractRow(db, value)
    replaceNestedData(db, value)
  })()
}

export function updateContract(db: Database.Database, value: Contract): void {
  db.transaction(() => {
    updateContractRow(db, value)
    replaceNestedData(db, value)
  })()
}

export function removeContract(db: Database.Database, id: string): void {
  assertWritable(db)
  const invoiceIds = db.prepare<[string], { id: string }>('SELECT id FROM invoices WHERE contract_id = ?').all(id)
  db.transaction(() => deleteContractRow(db, id))()
  const attachmentsRoot = attachmentsRootForDatabase(db)
  removeOwnerDirectory(attachmentsRoot, { type: 'contract', id })
  invoiceIds.forEach((invoice) => removeOwnerDirectory(attachmentsRoot, { type: 'invoice', id: invoice.id }))
}

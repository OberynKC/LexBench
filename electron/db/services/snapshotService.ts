import type Database from 'better-sqlite3'
import type { AppState } from '../../../src/types/api'
import { getMeta, META_KEYS } from '../repos/appMetaRepo'
import { mapCase, mapContract, mapFile, mapInvoice } from '../mappers'
import { listCaseRelationRows, listCaseRows } from '../repos/casesRepo'
import { listClients } from '../repos/clientsRepo'
import { listContractCaseRows, listContractRows } from '../repos/contractsRepo'
import { listEvents } from '../repos/eventsRepo'
import { listFees } from '../repos/feesRepo'
import { listFileRows } from '../repos/filesRepo'
import { listInvoiceRows } from '../repos/invoicesRepo'
import { listNotes } from '../repos/notesRepo'
import { listPreservations } from '../repos/preservationsRepo'
import { listTodos } from '../repos/todosRepo'
import { readReminderSeen } from '../repos/remindersRepo'

function pushToMap<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function readSnapshot(db: Database.Database): AppState {
  const relationMap = new Map<string, string[]>()
  for (const relation of listCaseRelationRows(db)) {
    pushToMap(relationMap, relation.case_id, relation.related_case_id)
  }

  const contractCaseMap = new Map<string, string[]>()
  for (const relation of listContractCaseRows(db)) {
    pushToMap(contractCaseMap, relation.contract_id, relation.case_id)
  }

  const contractFiles = new Map<string, ReturnType<typeof mapFile>[]>()
  const invoiceFiles = new Map<string, ReturnType<typeof mapFile>[]>()
  const caseFiles = new Map<string, ReturnType<typeof mapFile>[]>()
  for (const row of listFileRows(db)) {
    const file = mapFile(row)
    if (row.contract_id !== null) {
      pushToMap(contractFiles, row.contract_id, file)
    } else if (row.invoice_id !== null) {
      pushToMap(invoiceFiles, row.invoice_id, file)
    } else if (row.case_id !== null) {
      pushToMap(caseFiles, row.case_id, file)
    }
  }

  return {
    cases: listCaseRows(db).map((row) => mapCase(row, relationMap.get(row.id) ?? [], caseFiles.get(row.id) ?? [])),
    clients: listClients(db),
    notes: listNotes(db),
    preservations: listPreservations(db),
    events: listEvents(db),
    todos: listTodos(db),
    contracts: listContractRows(db).map((row) =>
      mapContract(row, contractCaseMap.get(row.id) ?? [], contractFiles.get(row.id) ?? []),
    ),
    fees: listFees(db),
    invoices: listInvoiceRows(db).map((row) => mapInvoice(row, invoiceFiles.get(row.id) ?? [])),
    userName: getMeta(db, META_KEYS.userName) ?? '',
    userGivenName: getMeta(db, META_KEYS.userGivenName) ?? '',
    testMode: getMeta(db, META_KEYS.testMode) === '1',
    demoImported: getMeta(db, META_KEYS.demoImported) === '1',
    reminderSeen: readReminderSeen(db),
    reminderSystem: getMeta(db, META_KEYS.reminderSystem) !== '0',
    reminderBadge: getMeta(db, META_KEYS.reminderBadge) !== '0',
  }
}

export function hasBusinessData(db: Database.Database): boolean {
  const row = db.prepare<[], { count: number }>(`
    SELECT (
      (SELECT COUNT(*) FROM clients) +
      (SELECT COUNT(*) FROM cases) +
      (SELECT COUNT(*) FROM contracts) +
      (SELECT COUNT(*) FROM fee_records) +
      (SELECT COUNT(*) FROM invoices) +
      (SELECT COUNT(*) FROM notes) +
      (SELECT COUNT(*) FROM preservations) +
      (SELECT COUNT(*) FROM todos) +
      (SELECT COUNT(*) FROM calendar_events)
    ) AS count
  `).get()
  return (row?.count ?? 0) > 0
}

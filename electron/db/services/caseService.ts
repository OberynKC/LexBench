import type Database from 'better-sqlite3'
import type { Case } from '../../../src/types'
import {
  createCase as createCaseRow,
  createCaseRelation,
  deleteCaseRelations,
  updateCase as updateCaseRow,
} from '../repos/casesRepo'

function replaceRelations(db: Database.Database, value: Case): void {
  deleteCaseRelations(db, value.id)
  value.relatedCaseIds.forEach((relatedId, index) => createCaseRelation(db, value.id, relatedId, index))
}

export function createCase(db: Database.Database, value: Case): void {
  db.transaction(() => {
    createCaseRow(db, value)
    replaceRelations(db, value)
  })()
}

export function updateCase(db: Database.Database, value: Case): void {
  db.transaction(() => {
    updateCaseRow(db, value)
    replaceRelations(db, value)
  })()
}

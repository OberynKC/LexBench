import type Database from 'better-sqlite3'
import type { Client } from '../../../src/types'
import { mapClient, type ClientRow } from '../mappers'
import { assertOne } from './common'

export function listClients(db: Database.Database): Client[] {
  return db.prepare<[], ClientRow>('SELECT * FROM clients ORDER BY rowid DESC').all().map(mapClient)
}

export function createClient(db: Database.Database, value: Client): void {
  const result = db.prepare(`
    INSERT INTO clients (id, name, type, phone, email, address, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(value.id, value.name, value.type, value.phone, value.email, value.address, value.note)
  assertOne(result)
}

export function updateClient(db: Database.Database, value: Client): void {
  const result = db.prepare(`
    UPDATE clients
    SET name = ?, type = ?, phone = ?, email = ?, address = ?, note = ?
    WHERE id = ?
  `).run(value.name, value.type, value.phone, value.email, value.address, value.note, value.id)
  assertOne(result)
}

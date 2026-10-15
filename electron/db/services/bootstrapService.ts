import type Database from 'better-sqlite3'
import type { AppState, BootstrapResult, InitialSetupPayload } from '../../../src/types/api'
import { assertDemoAllowed } from './settingsService'
import { validateUserName } from '../validation'
import { getMeta, setMeta, META_KEYS } from '../repos/appMetaRepo'
import { seedDemoData } from './seedService'
import { hasBusinessData, readSnapshot } from './snapshotService'
import { assertWritable } from '../../export/exportGate'

export function bootstrap(db: Database.Database): BootstrapResult {
  return db.transaction(() => {
    const completed = getMeta(db, META_KEYS.setupCompleted) === '1'
    if (completed) return { state: readSnapshot(db), setupRequired: false }

    if (hasBusinessData(db)) {
      assertWritable(db)
      setMeta(db, META_KEYS.setupCompleted, '1')
      return { state: readSnapshot(db), setupRequired: false }
    }

    return { state: readSnapshot(db), setupRequired: true }
  })()
}

export function initialize(db: Database.Database, payload: InitialSetupPayload): AppState {
  const surname = validateUserName(payload.userName)
  if (payload.mode === 'demo') assertDemoAllowed(db)
  return db.transaction(() => {
    const completed = getMeta(db, META_KEYS.setupCompleted) === '1'
    if (completed) return readSnapshot(db)

    if (hasBusinessData(db)) {
      setMeta(db, META_KEYS.setupCompleted, '1')
      return readSnapshot(db)
    }

    // 老库无 user_name 时回到此处写入本次填写的姓/名；此分支只在首启触发
    setMeta(db, META_KEYS.userName, surname)
    if (payload.userGivenName.trim()) setMeta(db, META_KEYS.userGivenName, payload.userGivenName.trim())
    if (payload.mode === 'demo') {
      seedDemoData(db)
      setMeta(db, META_KEYS.demoImported, '1')
    }
    setMeta(db, META_KEYS.setupCompleted, '1')
    return readSnapshot(db)
  })()
}

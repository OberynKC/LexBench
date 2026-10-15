import type Database from 'better-sqlite3'
import type { AppState } from '../../../src/types/api'
import { getMeta, setMeta, META_KEYS } from '../repos/appMetaRepo'
import { readSnapshot } from './snapshotService'
import { validateUserName } from '../validation'
import { seedDemoData } from './seedService'

/** 保存姓到 app_meta.user_name；空白不作为有效值 */
export function setUserName(db: Database.Database, surname: string): void {
  setMeta(db, META_KEYS.userName, validateUserName(surname))
}

/** 保存名到 app_meta.user_given_name（可空，用于头像等展示完整姓名） */
export function setUserGivenName(db: Database.Database, givenName: string): void {
  setMeta(db, META_KEYS.userGivenName, givenName.trim())
}

/** 切换测试模式到 app_meta.test_mode（'1' / '0'），即改即生效 */
export function setTestMode(db: Database.Database, on: boolean): void {
  setMeta(db, META_KEYS.testMode, on ? '1' : '0')
}

export function assertDemoAllowed(db: Database.Database): void {
  if (getMeta(db, META_KEYS.testMode) !== '1') throw new Error('请先开启测试模式再导入演示数据')
}

/**
 * 导入演示数据。测试模式开启且从未导入过（app_meta.demo_imported 未置位）时写入，
 * 否则返回当前快照（防御重复）。返回导入后的完整 AppState 供 renderer 替换。
 */
export function importDemo(db: Database.Database): AppState {
  return db.transaction(() => {
    assertDemoAllowed(db)
    if (getMeta(db, META_KEYS.demoImported) === '1') return readSnapshot(db)
    seedDemoData(db)
    setMeta(db, META_KEYS.demoImported, '1')
    return readSnapshot(db)
  })()
}

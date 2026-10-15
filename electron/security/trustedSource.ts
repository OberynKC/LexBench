import { fileURLToPath } from 'node:url'
import path from 'node:path'

/** 只接受应用首页；HashRouter 的片段不影响页面身份。 */
export function isTrustedPageUrl(value: string, indexFile: string, devServerUrl?: string): boolean {
  try {
    const url = new URL(value)
    if (devServerUrl) {
      const expected = new URL(devServerUrl)
      return url.origin === expected.origin && url.pathname === expected.pathname && url.search === '' && !url.username && !url.password
    }
    return url.protocol === 'file:' && !url.search && !url.hostname && path.resolve(fileURLToPath(url)) === path.resolve(indexFile)
  } catch { return false }
}

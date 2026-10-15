import type { AppState } from '../types/api'

/** 只接受三类站内来源，避免返回已经删除的详情或无效历史记录。 */
export function contractReturnPath(source: unknown, state: Pick<AppState, 'clients' | 'cases'>): string {
  if (typeof source !== 'string') return '/contracts'
  const pathname = source.split('?')[0]
  if (pathname === '/contracts') return source
  const match = /^\/(clients|cases)\/([^/?#]+)$/.exec(pathname)
  if (match && state[match[1] as 'clients' | 'cases'].some((item) => item.id === match[2])) return source
  return '/contracts'
}

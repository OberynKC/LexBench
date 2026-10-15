import type { AlertOptions, ConfirmOptions } from '../types/api'

export function errorMessage(error: unknown): string {
  const message = error instanceof Error && error.message ? error.message : '未知错误'
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** 提示失败不能阻止数据库恢复，也不能产生未处理的 Promise 拒绝。 */
export async function showAlert(message: string, title = '提示', type: AlertOptions['type'] = 'info'): Promise<void> {
  try {
    if (!window.api) { console.error(message); return }
    await window.api.dialogs.alert({ title, message, type })
  } catch (error) { console.error('显示提示失败', error) }
}

let confirming = false
export async function confirmAction(message: string, confirmLabel: ConfirmOptions['confirmLabel'] = '删除', title = `确认${confirmLabel}`): Promise<boolean> {
  if (confirming || !window.api) return false
  confirming = true
  try { return await window.api.dialogs.confirm({ title, message, confirmLabel }) } catch (error) {
    await showAlert(errorMessage(error), '无法显示确认', 'error')
    return false
  } finally { confirming = false }
}

import { dialog, type BrowserWindow } from 'electron'
import type { AlertOptions, ConfirmOptions } from '../../src/types/api'

// 同一窗口的提示串行展示，避免异步错误和确认相互覆盖。
const queues = new Map<number, Promise<unknown>>()
async function show(parent: BrowserWindow | null, options: Electron.MessageBoxOptions): Promise<number> {
  const key = parent?.webContents.id ?? 0
  const previous = queues.get(key) ?? Promise.resolve()
  const pending = previous.catch(() => undefined).then(async () => {
    if (parent?.isDestroyed()) return options.cancelId ?? 0
    const result = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options)
    return result.response
  })
  queues.set(key, pending)
  try { return await pending } finally { if (queues.get(key) === pending) queues.delete(key) }
}

export async function confirmDialog(parent: BrowserWindow | null, value: ConfirmOptions): Promise<boolean> {
  return await show(parent, {
    type: 'warning', title: value.title, message: value.message, detail: value.detail,
    buttons: ['取消', value.confirmLabel], defaultId: 0, cancelId: 0, noLink: true,
  }) === 1
}

export async function alertDialog(parent: BrowserWindow | null, value: AlertOptions): Promise<void> {
  await show(parent, {
    type: value.type ?? 'info', title: value.title, message: value.message, detail: value.detail,
    buttons: ['知道了'], defaultId: 0, cancelId: 0, noLink: true,
  })
}

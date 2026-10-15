/** 仅 smoke:ipc 的 esbuild 别名使用；生产构建仍 external Electron。 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const handlers = new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
export const controls = {
  userData: '', documents: '', appPath: '',
  messages: [] as Electron.MessageBoxOptions[],
  notifications: [] as { channel: string; value: boolean }[],
  revealed: [] as string[],
  relaunched: false, exitCode: undefined as number | undefined,
  onOpen: async (_options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> => ({ canceled: true, filePaths: [] }),
  onMessage: async (_options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> => ({ response: 0, checkboxChecked: false }),
}
export const app = {
  isPackaged: false,
  getPath: (name: string) => {
    if (name === 'userData') return controls.userData
    if (name === 'documents') return controls.documents
    throw new Error(`测试禁止访问未配置路径：${name}`)
  },
  getAppPath: () => controls.appPath,
  getVersion: () => '0.2.0',
  relaunch: () => { controls.relaunched = true },
  exit: (code: number) => { controls.exitCode = code },
}
export const testWindow = {
  isDestroyed: () => false,
  webContents: { id: 1, mainFrame: { url: pathToFileURL(path.join(__dirname, '../dist/index.html')).href }, send: (channel: string, value: boolean) => controls.notifications.push({ channel, value }) },
}
export const BrowserWindow = {
  fromWebContents: () => testWindow,
  getAllWindows: () => [testWindow],
}
export const ipcMain = {
  handle: (channel: string, handler: (event: unknown, payload: unknown) => Promise<unknown>) => {
    if (handlers.has(channel)) throw new Error(`重复注册：${channel}`)
    handlers.set(channel, handler)
  },
}
export const dialog = {
  showOpenDialog: (...args: unknown[]) => controls.onOpen(args[args.length - 1] as Electron.OpenDialogOptions),
  showMessageBox: (...args: unknown[]) => {
    const options = args[args.length - 1] as Electron.MessageBoxOptions
    controls.messages.push(options)
    return controls.onMessage(options)
  },
}
export const shell = {
  openPath: async () => '',
  showItemInFolder: (file: string) => { controls.revealed.push(file) },
}

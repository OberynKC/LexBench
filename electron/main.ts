import { app, BrowserWindow, dialog } from 'electron'
import path from 'node:path'
import { registerIpc } from './ipc/register'
import { installApplicationMenu } from './menu'
import { closeDatabase, getDatabase, initDatabase } from './db'
import { createReminderService } from './db/services/reminderService'
import { showReminderNotification, closeReminderNotifications } from './reminders/systemNotification'

// 已安装程序只加载随包附带的页面，避免继承开发环境变量。
const devServerUrl = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL
let mainWindow: BrowserWindow | null = null
let reminders: ReturnType<typeof createReminderService> | undefined

function focusMainWindow() {
  if (!app.isReady()) return
  if (!mainWindow) createWindow()
  const win = mainWindow!
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    title: '律衡',
    icon: app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(__dirname, '../build/icon.png'),
    // 与浅色主题底色一致；暗色用户的首屏背景由 index.html 内联样式兜底。
    backgroundColor: '#f5f6f8',
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 11 } }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  mainWindow = win
  // 渲染层仅展示本地应用页面；附件通过经过校验的主进程入口打开。
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.on('will-frame-navigate', (event) => event.preventDefault())
  win.webContents.on('will-redirect', (event) => event.preventDefault())
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  win.webContents.session.setPermissionCheckHandler(() => false)
  win.on('closed', () => { mainWindow = null })
  win.on('focus', () => { void reminders?.scan() })
  if (devServerUrl) {
    void win.loadURL(devServerUrl)
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// 同一数据目录只允许一个主进程，避免恢复时另一连接继续写入旧库。
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focusMainWindow)
  app.whenReady().then(() => {
    try {
      initDatabase()
      registerIpc()
      installApplicationMenu()
      createWindow()
      reminders = createReminderService(getDatabase(), (item) => showReminderNotification(item, focusMainWindow))
      reminders.start()
    } catch (error) {
      console.error('数据库初始化失败', error)
      const message = error instanceof Error ? error.message : '未知错误'
      dialog.showErrorBox('数据库初始化失败', `律衡无法打开或迁移本地数据库。\n\n${message}`)
      app.quit()
      return
    }
    app.on('activate', focusMainWindow)
  })
}

app.on('before-quit', () => {
  reminders?.stop()
  closeReminderNotifications()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

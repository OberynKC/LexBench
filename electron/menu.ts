import { app, Menu, type MenuItemConstructorOptions } from 'electron'

export function installApplicationMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = []
  if (isMac) {
    template.push({ label: '律衡', submenu: [
      { label: '关于律衡', role: 'about' },
      { type: 'separator' },
      { label: '服务', role: 'services' },
      { type: 'separator' },
      { label: '隐藏律衡', role: 'hide' },
      { label: '隐藏其他应用', role: 'hideOthers' },
      { label: '显示全部', role: 'unhide' },
      { type: 'separator' },
      { label: '退出律衡', role: 'quit' },
    ] })
  } else {
    template.push({ label: '文件', submenu: [{ label: '退出律衡', role: 'quit' }] })
  }
  template.push(
    { label: '编辑', submenu: [
      { label: '撤销', role: 'undo' }, { label: '重做', role: 'redo' },
      { type: 'separator' },
      { label: '剪切', role: 'cut' }, { label: '复制', role: 'copy' },
      { label: '粘贴', role: 'paste' }, { label: '全选', role: 'selectAll' },
    ] },
    { label: '显示', submenu: [
      { label: '实际大小', role: 'resetZoom' },
      { label: '放大', role: 'zoomIn' }, { label: '缩小', role: 'zoomOut' },
      { type: 'separator' }, { label: '切换全屏', role: 'togglefullscreen' },
      ...(!app.isPackaged ? [
        { type: 'separator' as const },
        { label: '重新加载', role: 'reload' as const },
        { label: '开发者工具', role: 'toggleDevTools' as const },
      ] : []),
    ] },
    { label: '窗口', submenu: [
      { label: '最小化', role: 'minimize' },
      { label: '缩放窗口', role: 'zoom' },
      { label: '关闭窗口', role: 'close' },
    ] },
  )
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

import { Notification } from 'electron'
import type { ReminderItem } from '../../src/lib/reminders'
import { daysUntil } from '../../src/lib/utils'

// 持有通知引用，以便横幅消失后仍能响应通知中心的点击。
const active = new Set<Notification>()
export function showReminderNotification(item: ReminderItem, focusWindow: () => void): Promise<boolean> {
  if (!Notification.isSupported()) return Promise.resolve(false)
  return new Promise((resolve) => {
    const days = daysUntil(item.deadline)
    const notification = new Notification({ title: '律衡 · 期限提醒',
      body: `${item.title}\n${item.deadline} · ${days < 0 ? `超期 ${-days} 天` : `剩余 ${days} 天`}` })
    active.add(notification)
    let settled = false
    const finish = (shown: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (!shown) { notification.close(); active.delete(notification) }
      resolve(shown)
    }
    const timeout = setTimeout(() => finish(false), 10_000)
    notification.once('show', () => finish(true))
    notification.once('failed', (_event, error) => {
      console.error('系统期限通知未能显示', error)
      finish(false)
    })
    notification.once('click', focusWindow)
    notification.once('close', () => { active.delete(notification); finish(false) })
    try { notification.show() } catch (error) { console.error('系统期限通知发送失败', error); finish(false) }
  })
}
export function closeReminderNotifications(): void {
  for (const notification of active) notification.close()
  active.clear()
}

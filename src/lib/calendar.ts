import dayjs, { type Dayjs } from 'dayjs'
import type { CalendarEvent, EventType } from '../types'

/**
 * 日历数据访问层：事件获取后的按日分组、日历格计算、类型色值映射都集中在这里。
 * 页面组件（日程表 / 仪表盘微缩月历）只消费本模块的接口；
 * SQLite 快照经 store 提供事件数组，本模块只负责分组与渲染所需派生数据。
 */

/** 事件类型色值映射：开庭 = 红、截止期限 = 琥珀、会见 = 蓝、其他 = 灰 */
export const eventTypeColor: Record<EventType, string> = {
  开庭: 'bg-red-500',
  截止期限: 'bg-amber-500',
  会见: 'bg-blue-500',
  其他: 'bg-gray-400',
}

/** 一周从周日开始（对齐 macOS 日历） */
export const weekDayNames = ['日', '一', '二', '三', '四', '五', '六']

/** 以周日为开头计算某月的 6×7 日历格 */
export function buildMonthCells(month: Dayjs): Dayjs[] {
  const first = month.startOf('month')
  const start = first.subtract(first.day(), 'day')
  return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
}

/** 事件按日分组（key 为 YYYY-MM-DD），每日内按开始时间升序 */
export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const key = dayjs(e.start).format('YYYY-MM-DD')
    const list = map.get(key) ?? []
    list.push(e)
    map.set(key, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf())
  }
  return map
}

/** 取某日的事件列表 */
export function getEventsOfDay(eventsByDay: Map<string, CalendarEvent[]>, day: Dayjs): CalendarEvent[] {
  return eventsByDay.get(day.format('YYYY-MM-DD')) ?? []
}

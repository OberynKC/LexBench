import type { Dayjs } from 'dayjs'

// 中国农历换算由运行时 Intl/ICU 提供。固定 UTC，按日历格子的年月日换算，
// 避免主机时区和夏令时将同一日历日期解释为前一天或后一天。
const calendar = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  timeZone: 'UTC', month: 'long', day: 'numeric',
})
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

/** 初一显示月份（含闰月），其余显示日名；范围为 1900-01-31 至 2100-12-31。 */
export function lunarDayText(date: Dayjs): string {
  if (!date.isValid() || calendar.resolvedOptions().calendar !== 'chinese') return ''
  const year = date.year()
  if (year < 1900 || year > 2100 || (year === 1900 && date.month() === 0 && date.date() < 31)) return ''
  const parts = calendar.formatToParts(new Date(Date.UTC(year, date.month(), date.date(), 12)))
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  if (day === 1) {
    return (parts.find((part) => part.type === 'month')?.value ?? '')
      .replace('十一月', '冬月').replace('十二月', '腊月')
  }
  return LUNAR_DAYS[day - 1] ?? ''
}

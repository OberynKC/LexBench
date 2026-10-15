import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import dayjs from 'dayjs'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 生成简单的本地 id */
export function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 金额格式化：1,234.5 万元 / 8,000 元 */
export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '-'
  if (amount >= 10000) {
    const wan = amount / 10000
    const text = wan >= 100 ? Math.round(wan).toLocaleString('zh-CN') : wan.toFixed(1).replace(/\.0$/, '')
    return `${text} 万元`
  }
  return `${amount.toLocaleString('zh-CN')} 元`
}

/** 完整金额（元，千分位） */
export function formatAmountFull(amount: number): string {
  if (!Number.isFinite(amount)) return '-'
  return `${amount.toLocaleString('zh-CN')} 元`
}

/** 文件大小格式化：1.5 MB / 320 KB */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '-'
  return dayjs(iso).format('YYYY-MM-DD')
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '-'
  return dayjs(iso).format('YYYY-MM-DD HH:mm')
}

export function formatTime(iso?: string | null): string {
  if (!iso) return '-'
  return dayjs(iso).format('HH:mm')
}

/**
 * 距离某日期还剩多少天（以天为单位，忽略时分秒）。
 * 负数表示已逾期。
 */
export function daysUntil(iso: string, now = dayjs()): number {
  return dayjs(iso).startOf('day').diff(now.startOf('day'), 'day')
}

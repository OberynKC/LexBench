import type { CaseType, ContractStatus, EventType, FeeRecord, Preservation, PreservationDisplayStatus, PreservationType, StageKind } from '../types'
import { Badge, type BadgeVariant } from './ui/badge'
import { daysUntil, formatDate } from '../lib/utils'
import { stageKindOf, stageLabel } from '../lib/stageTemplates'

const stageKindVariant: Record<StageKind, BadgeVariant> = {
  core: 'blue',
  branch: 'amber',
  terminal: 'green',
}

/** 阶段徽章：阶段名称由案件的阶段模板决定（如民事一审·庭前准备、刑事·审查起诉） */
export function StageBadge({ templateId, stageId }: { templateId: string; stageId: string }) {
  const kind = stageKindOf(templateId, stageId)
  return <Badge variant={kind ? stageKindVariant[kind] : 'gray'}>{stageLabel(templateId, stageId)}</Badge>
}

const caseTypeVariant: Record<CaseType, BadgeVariant> = {
  民事: 'blue',
  刑事: 'red',
  行政: 'amber',
  仲裁: 'secondary',
  非诉: 'gray',
}

export function CaseTypeBadge({ type }: { type: CaseType }) {
  return <Badge variant={caseTypeVariant[type]}>{type}</Badge>
}

const preservationTypeVariant: Record<PreservationType, BadgeVariant> = {
  财产保全: 'amber',
  行为保全: 'red',
  证据保全: 'blue',
  先予执行: 'red',
  查封扣押: 'gray',
}

export function PreservationTypeBadge({ type }: { type: PreservationType }) {
  return <Badge variant={preservationTypeVariant[type]}>{type}</Badge>
}

/**
 * 展示状态为派生值，随日期变化自动调整：
 * - 存储状态为结束 / 申请时直接沿用
 * - 已采取的措施（生效）按到期日细分：超期（期限已过）、临期（剩余 ≤60 天，含到期当天）、生效（剩余 >60 天）
 */
export function preservationStatusOf(p: Pick<Preservation, 'status' | 'deadline'>): PreservationDisplayStatus {
  if (p.status === '结束') return '结束'
  if (p.status === '申请') return '申请'
  if (!p.deadline) return '生效'
  const days = daysUntil(p.deadline)
  if (days < 0) return '超期'
  if (days <= 60) return '临期'
  return '生效'
}

const preservationStatusVariant: Record<PreservationDisplayStatus, BadgeVariant> = {
  申请: 'gray',
  生效: 'blue',
  临期: 'amber',
  超期: 'redSolid',
  结束: 'green',
}

export function PreservationStatusBadge({ preservation }: { preservation: Pick<Preservation, 'status' | 'deadline'> }) {
  const status = preservationStatusOf(preservation)
  return <Badge variant={preservationStatusVariant[status]}>{status}</Badge>
}

// 色值映射集中在日历数据访问层（src/lib/calendar.ts），此处转发以保持既有导入路径不变
export { eventTypeColor } from '../lib/calendar'

const contractStatusVariant: Record<ContractStatus, BadgeVariant> = {
  履行中: 'blue',
  已完结: 'green',
  已解除: 'gray',
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge variant={contractStatusVariant[status]}>{status}</Badge>
}

export type FeeStatus = '已收' | '部分收' | '未收' | '逾期'

/** 收款状态为派生值：实收 ≥ 应收 → 已收；部分到账 → 部分收；应收日已过且未收讫 → 逾期 */
export function feeStatusOf(fee: Pick<FeeRecord, 'amount' | 'receivedAmount' | 'dueDate'>): FeeStatus {
  if (fee.receivedAmount >= fee.amount) return '已收'
  if (fee.receivedAmount > 0) return daysUntil(fee.dueDate) < 0 ? '逾期' : '部分收'
  return daysUntil(fee.dueDate) < 0 ? '逾期' : '未收'
}

const feeStatusVariant: Record<FeeStatus, BadgeVariant> = {
  已收: 'green',
  部分收: 'amber',
  未收: 'gray',
  逾期: 'redSolid',
}

export function FeeStatusBadge({ fee }: { fee: Pick<FeeRecord, 'amount' | 'receivedAmount' | 'dueDate'> }) {
  return <Badge variant={feeStatusVariant[feeStatusOf(fee)]}>{feeStatusOf(fee)}</Badge>
}

const eventTypeBadgeVariant: Record<EventType, BadgeVariant> = {
  开庭: 'red',
  截止期限: 'amber',
  会见: 'blue',
  其他: 'gray',
}

export function EventTypeBadge({ type }: { type: EventType }) {
  return <Badge variant={eventTypeBadgeVariant[type]}>{type}</Badge>
}

/**
 * 到期倒计时徽章：
 * - 超期：红底白字「超期 N 天」
 * - ≤7 天：红色
 * - ≤60 天：琥珀色（与保全 / 执行「临期」口径一致）
 * - >60 天：灰色
 */
export function DeadlineBadge({ deadline, showDate = false }: { deadline: string; showDate?: boolean }) {
  const days = daysUntil(deadline)
  let variant: BadgeVariant = 'gray'
  let text = `剩余 ${days} 天`
  if (days < 0) {
    variant = 'redSolid'
    text = `超期 ${Math.abs(days)} 天`
  } else if (days <= 7) {
    variant = 'red'
  } else if (days <= 60) {
    variant = 'amber'
  }
  return (
    <Badge variant={variant}>
      {text}
      {showDate && <span className="opacity-70">（{formatDate(deadline)}）</span>}
    </Badge>
  )
}

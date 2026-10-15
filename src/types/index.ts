export type CaseType = '民事' | '刑事' | '行政' | '仲裁' | '非诉'

/**
 * 代理立场。阶段模板通过 StageTemplate.sides 限定可选范围，
 * 立场决定可从哪个阶段进入模板（如原告从「立案」、被告应诉从「庭前准备」）。
 */
export type PartySide =
  | '原告方'
  | '被告方'
  | '上诉人方'
  | '被上诉人方'
  | '申请人方'
  | '被申请人方'
  | '申请执行人方'
  | '被执行人方'
  | '辩护人'
  | '被害人方'
  | '自诉人方'
  | '案外人/第三人'
  | '无对抗立场'

/**
 * 阶段节点类型：
 * - core 主干阶段（构成案件的典型推进路径）
 * - branch 可选分支（如执行异议、死刑复核、重整/和解/清算），可跳过
 * - terminal 终态（结案/程序终结）
 * 回流（发回重审、退回补充侦查、终本后恢复执行）通过 next 指向更早阶段表达。
 */
export type StageKind = 'core' | 'branch' | 'terminal'

export interface StageNode {
  id: string
  label: string
  kind: StageKind
  /** 允许转移到的后续阶段 id；指向更早阶段即为回流边 */
  next: string[]
  /** 可作为收案入口（支持应诉、二审委托、执行委托等从中间阶段进入的情形） */
  entry?: boolean
  /** 关键期限 / 规则提示 */
  hint?: string
}

/**
 * 阶段模板：按「案件类型 × 程序实例」配置（如民事一审、刑事辩护、行政复议）。
 * 一个 Case 对应一个程序实例；程序间的转化（上诉、执行、衍生诉讼）
 * 以新建 Case + relatedCaseIds 关联表达，而不是同一案件的阶段延续。
 */
export interface StageTemplate {
  id: string
  /** 模板名，如「民事一审」「刑事辩护（公诉）」 */
  name: string
  caseType: CaseType
  /** 该模板下可选的代理立场 */
  sides: PartySide[]
  stages: StageNode[]
}

export interface Case {
  id: string
  /** 案号（非必填：诉前谈判、非诉业务、仲裁前保全等场景尚未取得案号，可立案后补录） */
  caseNumber?: string
  /** 案件名称 */
  title: string
  /** 案件类型 */
  type: CaseType
  /** 阶段模板 id（见 src/lib/stageTemplates.ts） */
  templateId: string
  /** 当前阶段（模板内节点 id） */
  stageId: string
  /** 代理立场 */
  side: PartySide
  /** 关联案件 id（上诉、执行、衍生诉讼等程序实例互相关联） */
  relatedCaseIds: string[]
  /** 委托人（客户 id） */
  clientId: string
  /** 对方当事人 */
  opposingParty: string
  /** 受理法院 / 仲裁委 */
  court: string
  /** 承办法官 */
  judge: string
  /** 法官联系方式 */
  judgePhone: string
  /** 标的金额（元） */
  amount: number
  /** 收案日期 */
  acceptedAt: string
  /** 下次关键节点日期 */
  nextDeadline: string
  /** 备注 */
  note: string
  /** 案件文档附件 */
  files: FileMeta[]
}

export type ClientType = '个人' | '企业'

export interface Client {
  id: string
  name: string
  type: ClientType
  phone: string
  email: string
  address: string
  note: string
}

export type FileOwnerType = 'contract' | 'invoice' | 'case'

/** 附件归属。每个附件必须且只能属于一个合同、发票或案件。 */
export interface FileOwner {
  type: FileOwnerType
  id: string
}

/** 已复制到应用本地附件目录的文件及其数据库元数据。 */
export interface FileMeta {
  id: string
  /** 界面展示的原始文件名（包括非 ASCII 字符） */
  name: string
  /** 磁盘存储名；在原名基础上追加短随机后缀以防重名 */
  storedName: string
  /** 相对于 userData/attachments 的 POSIX 路径 */
  relPath: string
  /** 字节数 */
  size: number
  uploadedAt: string
}

export type ContractStatus = '履行中' | '已完结' | '已解除'
export type FeeMode = '固定收费' | '风险代理' | '半风险代理' | '计时收费'

/**
 * 委托代理合同：挂在客户下，可关联多个案件（诉讼 + 非诉组合、
 * 一份合同覆盖一审 + 执行等）。案件不反向存合同 id，避免双向引用漂移。
 * 应收 / 实收 / 发票均挂在合同层，不按案件分摊——否则一合同多案件时
 * 汇总统计会重复计算。
 */
export interface Contract {
  id: string
  /** 合同编号 */
  contractNo: string
  /** 委托人（客户 id） */
  clientId: string
  /** 关联案件 id，可多、可空（非诉 / 诉前尚未建案） */
  caseIds: string[]
  /** 签约日期 */
  signedAt: string
  /** 收费方式 */
  feeMode: FeeMode
  /** 约定律师费总额（元） */
  totalFee: number
  status: ContractStatus
  /** 合同扫描件等附件 */
  files: FileMeta[]
  note: string
}

/**
 * 收费期次：一行 = 一期，应收与实收合并记录。
 * 收款状态为派生值（不入库）：实收 ≥ 应收 → 已收；0 < 实收 < 应收 → 部分收；
 * 实收为 0 → 未收；应收日期已过且未收讫 → 逾期。
 * 同一期的多笔分批到账明细不支持，可在 note 中补充。
 */
export interface FeeRecord {
  id: string
  contractId: string
  /** 期次，如「首期款」「尾款」「风险提成」 */
  label: string
  /** 应收金额（元） */
  amount: number
  /** 应收日期 */
  dueDate: string
  /** 实收金额（元，默认 0） */
  receivedAmount: number
  /** 最近收款日期，可空 */
  receivedAt: string
  note: string
}

export interface Invoice {
  id: string
  contractId: string
  /** 发票号码 */
  invoiceNo: string
  kind: '增值税普通发票' | '增值税专用发票'
  /** 开票金额（元） */
  amount: number
  /** 开票日期 */
  issuedAt: string
  /** 发票扫描件 */
  files: FileMeta[]
  note: string
}

export interface Note {
  id: string
  caseId: string
  title: string
  /** Markdown 正文 */
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface NoteVersion {
  id: string
  noteId: string
  title: string
  content: string
  tags: string[]
  createdAt: string
}

export interface NoteDraft {
  /** 已有笔记 ID；新建笔记固定为 __new__ */
  noteId: string
  /** 新建草稿可以暂未选择案件 */
  caseId: string
  title: string
  content: string
  tags: string[]
  savedAt: string
}

export type NoteDraftInput = Omit<NoteDraft, 'savedAt'>

/**
 * 保全 / 执行措施的类型。这些是挂在案件上的「措施」而非案件阶段：
 * 保全可发生于诉前、诉中、上诉期间、执行前、仲裁中等多个时点。
 * 「执行立案」本身是程序实例（应建为执行案件），不属于措施。
 */
export type PreservationType = '财产保全' | '行为保全' | '证据保全' | '先予执行' | '查封扣押'

/**
 * 保全 / 执行记录的人工生命周期（存储值，手工维护）：
 * - 申请：已立项准备或已提起申请，尚未采取措施
 * - 生效：已采取措施。临期 / 超期不存储，由到期日派生（见 badges.tsx 的 preservationStatusOf）
 * - 结束：已了结，无需再跟进（含保全解除、先予执行完毕、查封财产处置完毕、申请被驳回 / 撤回等）
 */
export type PreservationStatus = '申请' | '生效' | '结束'

/** 展示用状态（派生值）：在存储状态基础上，按到期日细分出临期（剩余 ≤60 日）与超期（期限已过） */
export type PreservationDisplayStatus = '申请' | '生效' | '临期' | '超期' | '结束'

export interface Preservation {
  id: string
  caseId: string
  type: PreservationType
  /** 保全 / 执行措施到期日（用于续封、续冻提醒）；申请阶段或无固定期限的措施（如先予执行）可为空 */
  deadline: string | null
  status: PreservationStatus
  note: string
}

export type EventType = '开庭' | '会见' | '截止期限' | '其他'

export interface CalendarEvent {
  id: string
  title: string
  type: EventType
  /** 关联案件，可空 */
  caseId: string | null
  /** ISO 时间 */
  start: string
  end: string
  location: string
  /** 提醒说明，如「提前 30 分钟」 */
  reminder: string
  /** 由待办事项自动生成的日程事件记录对应待办 id，用于同步删除/更新 */
  todoId?: string | null
}

export interface Todo {
  id: string
  /** 待办标题（纯文本） */
  title: string
  /** 关联案件，可空 */
  caseId: string | null
  done: boolean
  /** 期限（YYYY-MM-DD），可空 */
  deadline: string | null
  createdAt: string
}

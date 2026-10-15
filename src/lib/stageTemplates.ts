import type { CaseType, StageKind, StageNode, StageTemplate } from '../types'

/**
 * 阶段模板库：按「案件类型 × 程序实例」定义各业务的阶段有向图。
 *
 * 用于组织办案记录。阶段提示为操作清单，适用程序与期限由律师核对。
 * 设计要点：
 * - 每个模板描述一个程序实例（民事一审、刑事辩护、行政复议……）内部的阶段；
 * - stages 数组顺序即主干路径；kind = branch 的为可选分支，terminal 为终态；
 * - next 表达允许的转移：正常前进、分支、回流（指向更早阶段，如发回重审、退补）；
 * - entry = true 的阶段可以作为收案入口（应诉、二审委托、执行委托等从中间进入）；
 * - 程序之间的转化（上诉、执行、异议之诉等衍生诉讼）不在模板内表达，
 *   而是新建案件并通过 Case.relatedCaseIds 关联——与法院单独立案（民初/民终/执/执恢字）一致。
 */

export const STAGE_TEMPLATES: StageTemplate[] = [
  // ==================== 民事 ====================
  {
    id: 'civil-pre',
    name: '民事·诉前',
    caseType: '民事',
    sides: ['原告方', '被告方', '无对抗立场'],
    stages: [
      { id: 'consult', label: '咨询与评估', kind: 'core', entry: true, next: ['letter', 'negotiate', 'closed'], hint: '核对委托范围、材料目录及待核实问题；由律师确认适用路径与期限' },
      { id: 'letter', label: '律师函', kind: 'branch', next: ['negotiate', 'closed'], hint: '核对函件内容、发送方式与送达凭证，记录后续沟通' },
      { id: 'negotiate', label: '谈判 / 调解', kind: 'core', entry: true, next: ['closed'], hint: '记录各方方案、沟通结果及待确认事项，保存协议和履行材料' },
      { id: 'closed', label: '结案 / 转化', kind: 'terminal', next: [], hint: '核对履行情况、费用及附件，整理归档；后续程序可另建关联案件' },
    ],
  },
  {
    id: 'civil-first-instance',
    name: '民事一审',
    caseType: '民事',
    sides: ['原告方', '被告方', '案外人/第三人'],
    stages: [
      { id: 'filing', label: '立案', kind: 'core', entry: true, next: ['pretrial'], hint: '整理申请材料与提交凭证，登记受理进度并人工核对期限' },
      { id: 'pretrial', label: '庭前准备', kind: 'core', entry: true, next: ['hearing', 'closed'], hint: '核对答辩、举证及庭前安排，按实际文书手工登记期限' },
      { id: 'hearing', label: '开庭审理', kind: 'core', next: ['judgment', 'closed'], hint: '整理庭审提纲、材料目录和会议记录，核对后续提交事项' },
      { id: 'judgment', label: '裁判', kind: 'core', next: ['closed', 'pretrial'], hint: '登记裁判内容与送达日期，由律师核对后续程序和期限；新程序可另建关联案件' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [], hint: '核对履行情况、费用及附件，整理归档；后续程序可另建关联案件' },
    ],
  },
  {
    id: 'civil-second-instance',
    name: '民事二审',
    caseType: '民事',
    sides: ['上诉人方', '被上诉人方'],
    stages: [
      { id: 'appeal', label: '上诉与受理', kind: 'core', entry: true, next: ['hearing'], hint: '整理上诉材料与送达记录，由律师核对提交方式和期限' },
      { id: 'hearing', label: '二审审理', kind: 'core', next: ['judgment'], hint: '整理庭审提纲、材料目录和会议记录，核对后续提交事项' },
      { id: 'judgment', label: '二审裁判', kind: 'core', next: ['closed'], hint: '登记裁判内容与送达日期，由律师核对后续程序和期限；新程序可另建关联案件' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [], hint: '核对履行情况、费用及附件，整理归档；后续程序可另建关联案件' },
    ],
  },
  {
    id: 'civil-retrial',
    name: '民事再审',
    caseType: '民事',
    sides: ['申请人方', '被申请人方'],
    stages: [
      { id: 'apply', label: '再审申请与审查', kind: 'core', entry: true, next: ['hearing', 'closed'], hint: '核对申请条件、材料与提交记录，由律师确认适用程序及期限' },
      { id: 'hearing', label: '再审审理', kind: 'core', next: ['judgment'], hint: '整理庭审提纲、材料目录和会议记录，核对后续提交事项' },
      { id: 'judgment', label: '再审裁判', kind: 'core', next: ['closed'] },
      { id: 'closed', label: '结案', kind: 'terminal', next: [], hint: '核对履行情况、费用及附件，整理归档；后续程序可另建关联案件' },
    ],
  },
  {
    id: 'civil-enforcement',
    name: '民事执行',
    caseType: '民事',
    sides: ['申请执行人方', '被执行人方', '案外人/第三人'],
    stages: [
      { id: 'filing', label: '执行立案', kind: 'core', entry: true, next: ['control'], hint: '整理申请材料与提交凭证，登记受理进度并人工核对期限' },
      { id: 'control', label: '财产查控', kind: 'core', next: ['objection', 'settlement', 'disposal', 'suspended'] },
      { id: 'objection', label: '执行异议 / 复议', kind: 'branch', next: ['control', 'disposal'], hint: '登记异议材料及处理结果，核对后续程序；独立案件通过关联案件衔接' },
      { id: 'settlement', label: '执行和解', kind: 'branch', next: ['control', 'closed'], hint: '记录协商方案、协议及履行进度，由律师确认后续处理安排' },
      { id: 'disposal', label: '处置与分配', kind: 'core', next: ['objection', 'suspended', 'closed'], hint: '登记财产处置及分配材料，记录各方意见与待处理事项' },
      { id: 'suspended', label: '终结本次执行', kind: 'branch', next: ['control'], hint: '整理执行文书与财产线索，记录后续跟进；独立立案时新建关联案件' },
      { id: 'closed', label: '执行结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'civil-special',
    name: '民事特别程序',
    caseType: '民事',
    sides: ['申请人方', '被申请人方'],
    stages: [
      { id: 'apply', label: '申请与受理', kind: 'core', entry: true, next: ['review'], hint: '核对申请条件、材料与提交记录，由律师确认适用程序及期限' },
      { id: 'review', label: '审查', kind: 'core', next: ['ruling'] },
      { id: 'ruling', label: '裁定', kind: 'core', next: ['closed'], hint: '保存裁定、送达凭证及处理结果，由律师核对后续程序' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },

  // ==================== 刑事 ====================
  {
    id: 'criminal-defense',
    name: '刑事辩护（公诉）',
    caseType: '刑事',
    sides: ['辩护人'],
    stages: [
      { id: 'investigation', label: '侦查', kind: 'core', entry: true, next: ['review', 'closed'], hint: '核对委托手续、会见及沟通安排，记录文书和人工确认的期限' },
      { id: 'review', label: '审查起诉', kind: 'core', entry: true, next: ['first-instance', 'investigation', 'closed'], hint: '整理审查材料、提交凭证及反馈，人工核对进度和期限' },
      { id: 'first-instance', label: '一审', kind: 'core', entry: true, next: ['second-instance', 'closed'], hint: '整理庭审材料与意见，记录裁判及送达情况，由律师核对后续程序' },
      { id: 'second-instance', label: '二审', kind: 'core', entry: true, next: ['death-review', 'execution', 'first-instance', 'closed'], hint: '整理争议事项、补充材料及审理记录，由律师核对后续程序' },
      { id: 'death-review', label: '死刑复核', kind: 'branch', next: ['execution', 'closed'], hint: '整理复核材料及律师意见，记录提交和沟通情况' },
      { id: 'execution', label: '刑罚执行', kind: 'branch', next: ['closed'], hint: '登记执行文书、申请事项及反馈，按实际进度更新记录' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'criminal-victim',
    name: '刑事·被害人代理',
    caseType: '刑事',
    sides: ['被害人方'],
    stages: [
      { id: 'review', label: '审查起诉', kind: 'core', entry: true, next: ['first-instance', 'closed'], hint: '整理审查材料、提交凭证及反馈，人工核对进度和期限' },
      { id: 'first-instance', label: '一审', kind: 'core', next: ['second-instance', 'closed'] },
      { id: 'second-instance', label: '二审', kind: 'core', next: ['execution', 'closed'], hint: '整理争议事项、补充材料及审理记录，由律师核对后续程序' },
      { id: 'execution', label: '执行 / 附带民事执行', kind: 'branch', next: ['closed'] },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'criminal-private',
    name: '刑事自诉',
    caseType: '刑事',
    sides: ['自诉人方', '被告方'],
    stages: [
      { id: 'filing', label: '提起自诉', kind: 'core', entry: true, next: ['hearing', 'closed'], hint: '整理申请材料与提交凭证，登记受理进度并人工核对期限' },
      { id: 'hearing', label: '审理', kind: 'core', next: ['judgment', 'closed'], hint: '整理庭审提纲、材料目录和会议记录，核对后续提交事项' },
      { id: 'judgment', label: '裁判', kind: 'core', next: ['closed'], hint: '登记裁判内容与送达日期，由律师核对后续程序和期限；新程序可另建关联案件' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },

  // ==================== 行政 ====================
  {
    id: 'admin-reconsideration',
    name: '行政复议',
    caseType: '行政',
    sides: ['申请人方', '被申请人方'],
    stages: [
      { id: 'apply', label: '复议申请', kind: 'core', entry: true, next: ['accept', 'closed'], hint: '核对申请条件、材料与提交记录，由律师确认适用程序及期限' },
      { id: 'accept', label: '受理', kind: 'core', next: ['review'], hint: '保存受理通知及送达凭证，核对材料补充要求与期限' },
      { id: 'review', label: '审理', kind: 'core', next: ['decision'], hint: '整理审查材料、提交凭证及反馈，人工核对进度和期限' },
      { id: 'decision', label: '复议决定', kind: 'core', next: ['closed'], hint: '保存决定和送达凭证，由律师核对后续程序；独立案件可另建关联' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'admin-first-instance',
    name: '行政一审',
    caseType: '行政',
    sides: ['原告方', '被告方', '案外人/第三人'],
    stages: [
      { id: 'filing', label: '立案', kind: 'core', entry: true, next: ['pretrial'], hint: '整理申请材料与提交凭证，登记受理进度并人工核对期限' },
      { id: 'pretrial', label: '庭前准备', kind: 'core', entry: true, next: ['hearing', 'closed'], hint: '核对答辩、举证及庭前安排，按实际文书手工登记期限' },
      { id: 'hearing', label: '开庭审理', kind: 'core', next: ['judgment'], hint: '整理庭审提纲、材料目录和会议记录，核对后续提交事项' },
      { id: 'judgment', label: '裁判', kind: 'core', next: ['closed'], hint: '登记裁判内容与送达日期，由律师核对后续程序和期限；新程序可另建关联案件' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'admin-second-instance',
    name: '行政二审',
    caseType: '行政',
    sides: ['上诉人方', '被上诉人方'],
    stages: [
      { id: 'appeal', label: '上诉与受理', kind: 'core', entry: true, next: ['hearing'] },
      { id: 'hearing', label: '二审审理', kind: 'core', next: ['judgment'], hint: '整理庭审提纲、材料目录和会议记录，核对后续提交事项' },
      { id: 'judgment', label: '二审裁判', kind: 'core', next: ['closed'], hint: '登记裁判内容与送达日期，由律师核对后续程序和期限；新程序可另建关联案件' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'admin-retrial',
    name: '行政再审',
    caseType: '行政',
    sides: ['申请人方', '被申请人方'],
    stages: [
      { id: 'apply', label: '再审申请与审查', kind: 'core', entry: true, next: ['hearing', 'closed'], hint: '核对申请条件、材料与提交记录，由律师确认适用程序及期限' },
      { id: 'hearing', label: '再审审理', kind: 'core', next: ['judgment'] },
      { id: 'judgment', label: '再审裁判', kind: 'core', next: ['closed'] },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'admin-enforcement',
    name: '行政裁判执行',
    caseType: '行政',
    sides: ['申请执行人方', '被执行人方'],
    stages: [
      { id: 'filing', label: '执行立案', kind: 'core', entry: true, next: ['control'], hint: '整理申请材料与提交凭证，登记受理进度并人工核对期限' },
      { id: 'control', label: '财产查控', kind: 'core', next: ['disposal', 'closed'] },
      { id: 'disposal', label: '处置与分配', kind: 'core', next: ['closed'] },
      { id: 'closed', label: '执行结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'admin-nonlit-exec',
    name: '行政非诉执行',
    caseType: '行政',
    sides: ['申请执行人方', '被执行人方'],
    stages: [
      { id: 'urge', label: '催告', kind: 'core', entry: true, next: ['apply'], hint: '核对催告材料、送达凭证及反馈，记录后续安排' },
      { id: 'apply', label: '申请法院执行', kind: 'core', entry: true, next: ['review'], hint: '核对申请条件、材料与提交记录，由律师确认适用程序及期限' },
      { id: 'review', label: '受理与审查', kind: 'core', next: ['execution', 'closed'], hint: '整理审查材料、提交凭证及反馈，人工核对进度和期限' },
      { id: 'execution', label: '执行实施', kind: 'core', next: ['closed'] },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },

  // ==================== 仲裁 ====================
  {
    id: 'arbitration-commercial',
    name: '商事仲裁',
    caseType: '仲裁',
    sides: ['申请人方', '被申请人方'],
    stages: [
      { id: 'apply', label: '仲裁申请', kind: 'core', entry: true, next: ['accept'], hint: '核对申请条件、材料与提交记录，由律师确认适用程序及期限' },
      { id: 'accept', label: '受理', kind: 'core', entry: true, next: ['tribunal'], hint: '保存受理通知及送达凭证，核对材料补充要求与期限' },
      { id: 'tribunal', label: '组庭', kind: 'core', next: ['hearing'] },
      { id: 'hearing', label: '开庭审理', kind: 'core', next: ['award', 'closed'], hint: '整理庭审提纲、材料目录和会议记录，核对后续提交事项' },
      { id: 'award', label: '裁决', kind: 'core', next: ['closed'], hint: '保存裁决与送达记录，核对履行情况及后续程序；独立案件可另建关联' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'arbitration-labor',
    name: '劳动仲裁',
    caseType: '仲裁',
    sides: ['申请人方', '被申请人方'],
    stages: [
      { id: 'apply', label: '仲裁申请', kind: 'core', entry: true, next: ['accept', 'closed'], hint: '核对申请条件、材料与提交记录，由律师确认适用程序及期限' },
      { id: 'accept', label: '受理', kind: 'core', entry: true, next: ['hearing'], hint: '保存受理通知及送达凭证，核对材料补充要求与期限' },
      { id: 'hearing', label: '开庭与裁决', kind: 'core', next: ['closed'], hint: '整理庭审提纲、材料目录和会议记录，核对后续提交事项' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [], hint: '核对履行情况、费用及附件，整理归档；后续程序可另建关联案件' },
    ],
  },

  // ==================== 非诉 ====================
  {
    id: 'nonlit-advisory',
    name: '常年法律顾问',
    caseType: '非诉',
    sides: ['无对抗立场'],
    stages: [
      { id: 'onboarding', label: '签约与需求摸排', kind: 'core', entry: true, next: ['service'] },
      { id: 'service', label: '日常服务期', kind: 'core', next: ['review', 'closed'], hint: '记录咨询、审查、培训等服务事项，核对委托范围与交付情况' },
      { id: 'review', label: '年度总结与续约', kind: 'core', next: ['service', 'closed'] },
      { id: 'closed', label: '终止', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'nonlit-transaction',
    name: '专项交易（尽调/并购）',
    caseType: '非诉',
    sides: ['无对抗立场'],
    stages: [
      { id: 'intake', label: '前期接洽', kind: 'core', entry: true, next: ['due-diligence'], hint: '核对保密安排、意向文件、委托范围及材料清单' },
      { id: 'due-diligence', label: '尽职调查', kind: 'core', next: ['structuring', 'closed'], hint: '登记调查材料、核实结果及待补充事项，记录项目推进安排' },
      { id: 'structuring', label: '交易结构设计', kind: 'core', next: ['negotiation'] },
      { id: 'negotiation', label: '谈判', kind: 'core', next: ['drafting', 'structuring', 'closed'], hint: '记录各方意见，关联结构设计与文件起草任务' },
      { id: 'drafting', label: '文件起草', kind: 'core', next: ['negotiation', 'signing'] },
      { id: 'signing', label: '签约与先决条件', kind: 'core', next: ['closing', 'closed'], hint: '核对签署文件、先决条件和审批登记事项，跟踪完成状态' },
      { id: 'closing', label: '交割', kind: 'core', next: ['post', 'closed'] },
      { id: 'post', label: '交割后整合', kind: 'branch', next: ['closed'] },
      { id: 'closed', label: '完成 / 终止', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'nonlit-compliance',
    name: '企业合规',
    caseType: '非诉',
    sides: ['无对抗立场'],
    stages: [
      { id: 'assess', label: '风险识别与评估', kind: 'core', entry: true, next: ['org'] },
      { id: 'org', label: '组织体系搭建', kind: 'core', next: ['rules'] },
      { id: 'rules', label: '制度体系建设', kind: 'core', next: ['operation'] },
      { id: 'operation', label: '运行机制嵌入', kind: 'core', next: ['training'] },
      { id: 'training', label: '培训与合规文化', kind: 'core', next: ['evaluate'] },
      { id: 'evaluate', label: '有效性评价', kind: 'core', next: ['assess', 'closed'], hint: '记录评价结果及改进事项，更新风险识别和制度修订任务' },
      { id: 'closed', label: '结案', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'nonlit-bankruptcy',
    name: '破产管理',
    caseType: '非诉',
    sides: ['无对抗立场'],
    stages: [
      { id: 'acceptance', label: '受理与指定管理人', kind: 'core', entry: true, next: ['takeover'], hint: '保存受理与指定文件，核对接管清单及相关案件处理安排' },
      { id: 'takeover', label: '接管与财产调查', kind: 'core', next: ['claims'] },
      { id: 'claims', label: '债权申报与审查', kind: 'core', next: ['creditors-meeting'], hint: '登记债权材料、审查记录与异议，由律师核对申报安排及期限' },
      { id: 'creditors-meeting', label: '债权人会议', kind: 'core', next: ['restructuring', 'settlement', 'liquidation'] },
      { id: 'restructuring', label: '重整', kind: 'branch', next: ['closed', 'liquidation'], hint: '登记方案、提交记录及反馈，跟踪后续任务' },
      { id: 'settlement', label: '和解', kind: 'branch', next: ['closed', 'liquidation'], hint: '记录协商方案、协议及履行进度，由律师确认后续处理安排' },
      { id: 'liquidation', label: '清算', kind: 'branch', next: ['closed'], hint: '整理清算材料、财产处置及分配记录，核对后续任务' },
      { id: 'closed', label: '程序终结', kind: 'terminal', next: [] },
    ],
  },
  {
    id: 'nonlit-general',
    name: '非诉通用',
    caseType: '非诉',
    sides: ['无对抗立场'],
    stages: [
      { id: 'intake', label: '接洽与委托', kind: 'core', entry: true, next: ['research'] },
      { id: 'research', label: '尽调 / 材料审查', kind: 'core', next: ['service'] },
      { id: 'service', label: '服务实施', kind: 'core', next: ['delivery'] },
      { id: 'delivery', label: '成果交付', kind: 'core', next: ['closed'] },
      { id: 'closed', label: '结案归档', kind: 'terminal', next: [] },
    ],
  },
]

export function getTemplate(id: string): StageTemplate | undefined {
  return STAGE_TEMPLATES.find((t) => t.id === id)
}

export function templatesOfType(type: CaseType): StageTemplate[] {
  return STAGE_TEMPLATES.filter((t) => t.caseType === type)
}

export function stageOf(templateId: string, stageId: string): StageNode | undefined {
  return getTemplate(templateId)?.stages.find((s) => s.id === stageId)
}

export function stageLabel(templateId: string, stageId: string): string {
  return stageOf(templateId, stageId)?.label ?? stageId
}

export function stageKindOf(templateId: string, stageId: string): StageKind | undefined {
  return stageOf(templateId, stageId)?.kind
}

/** 模板的首个收案入口阶段（新建案件时的默认当前阶段） */
export function firstEntryStage(template: StageTemplate): StageNode {
  return template.stages.find((s) => s.entry) ?? template.stages[0]
}

/**
 * 计算阶段步骤条的渲染状态：
 * - 步骤条只展示主干链（core + terminal），分支阶段不进入主链；
 * - 当前阶段为分支时，主链推进到「能到达该分支的最后一个主干阶段」，
 *   并把分支节点单独返回（branch），由界面另行标注。
 */
export function stageProgress(
  template: StageTemplate | undefined,
  stageId: string,
): { main: StageNode[]; activeIndex: number; branch?: StageNode } {
  if (!template) return { main: [], activeIndex: -1 }
  const main = template.stages.filter((s) => s.kind !== 'branch')
  const current = template.stages.find((s) => s.id === stageId)
  if (!current) return { main, activeIndex: -1 }
  if (current.kind !== 'branch') {
    return { main, activeIndex: main.findIndex((s) => s.id === stageId) }
  }
  // 找锚点：主链中 next 指向该分支的最后一个主干阶段
  let anchorIndex = -1
  main.forEach((s, i) => {
    if (s.next.includes(stageId)) anchorIndex = i
  })
  return { main, activeIndex: anchorIndex, branch: current }
}

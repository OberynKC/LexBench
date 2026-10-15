import dayjs from 'dayjs'
import type { CalendarEvent, Case, Client, Contract, FeeRecord, FileMeta, Invoice, Note, Preservation, Todo } from '../types'

/**
 * 全部内容为虚构使用示例。身份、联系方式和编号均采用演示占位值。
 * 所有日期均基于「今天」动态计算，保证任何时候打开演示，
 * 开庭提醒、到期预警、逾期标记都处于有效状态。
 */
const d = (offset: number) => dayjs().add(offset, 'day').format('YYYY-MM-DD')
const dt = (offset: number, time: string) =>
  dayjs().add(offset, 'day').format('YYYY-MM-DD') + 'T' + time + ':00'

export const clients: Client[] = [
  { id: 'c1', name: '客户甲', type: '个人', phone: '示例电话-01', email: 'client01@example.com', address: '示例地址-01', note: '老客户，介绍过多个案件' },
  { id: 'c2', name: '客户乙', type: '个人', phone: '示例电话-02', email: 'client02@example.com', address: '示例地址-02', note: '' },
  { id: 'c3', name: '客户丙', type: '个人', phone: '示例电话-03', email: 'client03@example.com', address: '示例地址-03', note: '案件较多，注意沟通频率' },
  { id: 'c4', name: '客户丁', type: '个人', phone: '示例电话-04', email: 'client04@example.com', address: '示例地址-04', note: '' },
  { id: 'c5', name: '公司甲（示例）', type: '企业', phone: '示例电话-05', email: 'client05@example.com', address: '示例地址-05', note: '常年法律顾问单位' },
  { id: 'c6', name: '公司乙（示例）', type: '企业', phone: '示例电话-06', email: 'client06@example.com', address: '示例地址-06', note: '法务对接人：联系人甲（示例）' },
  { id: 'c7', name: '公司丙（示例）', type: '企业', phone: '示例电话-07', email: 'client07@example.com', address: '示例地址-07', note: '' },
  { id: 'c8', name: '公司丁（示例）', type: '企业', phone: '示例电话-08', email: 'client08@example.com', address: '示例地址-08', note: '' },
]

const caseSeeds: Omit<Case, 'files'>[] = [
  { id: 'case1', caseNumber: '演示案号(001)', title: '客户甲诉对方甲买卖合同纠纷', type: '民事', templateId: 'civil-first-instance', stageId: 'hearing', side: '原告方', relatedCaseIds: [], clientId: 'c1', opposingParty: '对方甲', court: '示例受理机构-001', judge: '示例经办人-001', judgePhone: '示例电话-001', amount: 860000, acceptedAt: d(-120), nextDeadline: d(2), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case2', caseNumber: '演示案号(002)', title: '客户丙涉嫌职务侵占案（辩护）', type: '刑事', templateId: 'criminal-defense', stageId: 'first-instance', side: '辩护人', relatedCaseIds: [], clientId: 'c3', opposingParty: '检察机关甲（示例）', court: '示例受理机构-002', judge: '示例经办人-002', judgePhone: '示例电话-002', amount: 2350000, acceptedAt: d(-90), nextDeadline: d(12), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case3', caseNumber: '演示案号(003)', title: '公司甲诉公司戊著作权侵权纠纷', type: '民事', templateId: 'civil-first-instance', stageId: 'pretrial', side: '原告方', relatedCaseIds: [], clientId: 'c5', opposingParty: '公司戊（示例）', court: '示例受理机构-003', judge: '示例经办人-003', judgePhone: '示例电话-003', amount: 5800000, acceptedAt: d(-60), nextDeadline: d(5), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case4', caseNumber: '演示案号(004)', title: '公司乙与公司己建设工程施工合同仲裁案', type: '仲裁', templateId: 'arbitration-commercial', stageId: 'hearing', side: '申请人方', relatedCaseIds: [], clientId: 'c6', opposingParty: '公司己（示例）', court: '示例受理机构-004', judge: '示例经办人-004', judgePhone: '示例电话-004', amount: 26800000, acceptedAt: d(-150), nextDeadline: d(20), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case5', caseNumber: '演示案号(005)', title: '客户丁诉某区市场监管局行政处罚案', type: '行政', templateId: 'admin-first-instance', stageId: 'filing', side: '原告方', relatedCaseIds: [], clientId: 'c4', opposingParty: '行政机关甲（示例）', court: '示例受理机构-005', judge: '示例经办人-005', judgePhone: '示例电话-005', amount: 150000, acceptedAt: d(-8), nextDeadline: d(15), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case6', caseNumber: '演示案号(006)', title: '客户乙诉保险公司（示例）人身保险合同纠纷', type: '民事', templateId: 'civil-enforcement', stageId: 'control', side: '申请执行人方', relatedCaseIds: [], clientId: 'c2', opposingParty: '保险公司（示例）', court: '示例受理机构-006', judge: '示例经办人-006', judgePhone: '示例电话-006', amount: 1200000, acceptedAt: d(-300), nextDeadline: d(6), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case7', caseNumber: '演示案号(007)', title: '公司丁诉公司辛运输合同纠纷', type: '民事', templateId: 'civil-first-instance', stageId: 'pretrial', side: '原告方', relatedCaseIds: [], clientId: 'c8', opposingParty: '公司辛（示例）', court: '示例受理机构-007', judge: '示例经办人-007', judgePhone: '示例电话-007', amount: 460000, acceptedAt: d(-45), nextDeadline: d(3), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case8', caseNumber: '演示案号(008)', title: '公司丙诉公司庚侵犯出版权纠纷', type: '民事', templateId: 'civil-first-instance', stageId: 'hearing', side: '原告方', relatedCaseIds: [], clientId: 'c7', opposingParty: '公司庚（示例）', court: '示例受理机构-008', judge: '示例经办人-008', judgePhone: '示例电话-008', amount: 890000, acceptedAt: d(-75), nextDeadline: d(1), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case9', caseNumber: '演示案号(009)', title: '客户丙涉嫌非法吸收公众存款案（辩护）', type: '刑事', templateId: 'criminal-defense', stageId: 'first-instance', side: '辩护人', relatedCaseIds: [], clientId: 'c3', opposingParty: '检察机关乙（示例）', court: '示例受理机构-009', judge: '示例经办人-009', judgePhone: '示例电话-009', amount: 12000000, acceptedAt: d(-5), nextDeadline: d(25), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case10', caseNumber: '演示案号(010)', title: '客户甲诉公司壬装修合同纠纷', type: '民事', templateId: 'civil-first-instance', stageId: 'closed', side: '原告方', relatedCaseIds: [], clientId: 'c1', opposingParty: '公司壬（示例）', court: '示例受理机构-010', judge: '示例经办人-010', judgePhone: '示例电话-010', amount: 230000, acceptedAt: d(-400), nextDeadline: d(-30), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case11', caseNumber: '演示案号(011)', title: '公司甲与公司癸技术服务合同仲裁案', type: '仲裁', templateId: 'arbitration-commercial', stageId: 'closed', side: '申请人方', relatedCaseIds: [], clientId: 'c5', opposingParty: '公司癸（示例）', court: '示例受理机构-011', judge: '示例经办人-011', judgePhone: '示例电话-011', amount: 3200000, acceptedAt: d(-200), nextDeadline: d(-10), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case12', caseNumber: '演示案号(012)', title: '客户丙诉对方乙民间借贷纠纷', type: '民事', templateId: 'civil-first-instance', stageId: 'hearing', side: '原告方', relatedCaseIds: [], clientId: 'c3', opposingParty: '对方乙', court: '示例受理机构-012', judge: '示例经办人-012', judgePhone: '示例电话-012', amount: 150000, acceptedAt: d(-55), nextDeadline: d(8), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  { id: 'case13', caseNumber: '演示案号(013)', title: '公司乙申请执行公司己案', type: '民事', templateId: 'civil-enforcement', stageId: 'disposal', side: '申请执行人方', relatedCaseIds: ['case14'], clientId: 'c6', opposingParty: '公司己（示例）', court: '示例受理机构-013', judge: '示例经办人-013', judgePhone: '示例电话-013', amount: 5400000, acceptedAt: d(-150), nextDeadline: d(-5), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  // 衍生诉讼：案外人执行异议之诉，单独立案（民初字）、独立案件，与执行案件关联
  { id: 'case14', caseNumber: '演示案号(014)', title: '公司乙应对案外人执行异议之诉', type: '民事', templateId: 'civil-first-instance', stageId: 'filing', side: '被告方', relatedCaseIds: ['case13'], clientId: 'c6', opposingParty: '案外人甲（示例）', court: '示例受理机构-014', judge: '', judgePhone: '', amount: 3200000, acceptedAt: d(-6), nextDeadline: d(9), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
  // 诉前案件：咨询谈判阶段，尚未立案，无案号
  { id: 'case15', title: '公司甲与公司子服务合同纠纷（诉前）', type: '民事', templateId: 'civil-pre', stageId: 'negotiate', side: '原告方', relatedCaseIds: [], clientId: 'c5', opposingParty: '公司子（示例）', court: '', judge: '', judgePhone: '', amount: 1200000, acceptedAt: d(-20), nextDeadline: d(7), note: '演示事项：核对案件材料、记录进度，并人工确认下一步安排。' },
]

export const cases: Case[] = caseSeeds.map((value) => ({ ...value, files: [] }))

export const notes: Note[] = [
  { id: 'n1', caseId: 'case1', title: '庭审材料核对清单', content: '## 材料核对\n\n- 核对**送货单原件**与复印件\n- 整理对账单及签收记录\n\n> 在笔记中记录材料来源与待核实事项\n\n## 待办\n1. 联系客户甲确认材料\n2. 整理庭审提纲', tags: ['庭审记录', '策略'], createdAt: dt(-3, '10:20'), updatedAt: dt(-1, '16:45') },
  { id: 'n2', caseId: 'case1', title: '客户甲沟通记录', content: '## 沟通事项\n\n- 核对交货记录\n- 登记补充材料清单\n- 记录客户意见及沟通日期', tags: ['客户沟通'], createdAt: dt(-10, '14:00'), updatedAt: dt(-10, '14:30') },
  { id: 'n3', caseId: 'case2', title: '阅卷材料索引', content: '## 卷宗目录\n\n- 登记卷号、页码和材料名称\n- 对照资金往来记录\n\n`待办：制作材料索引表`', tags: ['阅卷', '证据梳理'], createdAt: dt(-20, '09:30'), updatedAt: dt(-18, '11:00') },
  { id: 'n4', caseId: 'case2', title: '会见准备清单', content: '- 确认预约时间与地点\n- 整理待询问事项\n- 会见后记录答复与后续安排', tags: ['会见'], createdAt: dt(-2, '18:00'), updatedAt: dt(-2, '18:00') },
  { id: 'n5', caseId: 'case3', title: '著作权材料比对清单', content: '## 比对准备\n\n- 确认作品版本与取得来源\n- 整理**差异对照表**\n- 将待核实项目单独标记', tags: ['法律研究', '证据梳理'], createdAt: dt(-30, '15:00'), updatedAt: dt(-12, '10:10') },
  { id: 'n6', caseId: 'case3', title: '保全事项核对清单', content: '- 对照文书核实措施范围与到期日\n- 登记续期所需材料\n- 人工确认期限后建立待办', tags: ['保全', '待办'], createdAt: dt(-5, '11:00'), updatedAt: dt(-5, '11:00') },
  { id: 'n7', caseId: 'case4', title: '鉴定材料阅读记录', content: '## 阅读步骤\n\n- 核对报告版本与附件\n- 整理计价项目及计算过程\n- 记录待向客户核实的问题', tags: ['法律研究'], createdAt: dt(-15, '16:20'), updatedAt: dt(-14, '09:00') },
  { id: 'n8', caseId: 'case4', title: '公司乙沟通会议清单', content: '- 记录参会人员与材料清单\n- 核对合同及签证材料\n- 约定下次沟通事项', tags: ['客户沟通'], createdAt: dt(-7, '13:30'), updatedAt: dt(-7, '13:30') },
  { id: 'n9', caseId: 'case5', title: '行政案件材料清单', content: '## 材料目录\n1. 行政文书与送达记录\n2. 客户提供的相关材料\n3. 需要进一步核实的程序信息', tags: ['策略', '法律研究'], createdAt: dt(-6, '10:00'), updatedAt: dt(-4, '17:30') },
  { id: 'n10', caseId: 'case6', title: '执行事项跟进清单', content: '- 记录沟通时间与对象\n- 对照文书核对进度\n- 向客户乙确认已收款项', tags: ['执行', '客户沟通'], createdAt: dt(-4, '09:40'), updatedAt: dt(-1, '15:20') },
  { id: 'n11', caseId: 'case7', title: '车辆线索核对清单', content: '- 登记线索来源\n- 核实车辆识别信息与权属材料\n- 记录补充材料状态', tags: ['保全', '待办'], createdAt: dt(-8, '14:10'), updatedAt: dt(-3, '10:00') },
  { id: 'n12', caseId: 'case8', title: '庭前会议记录提纲', content: '- 核对材料交换情况\n- 记录各方意见\n- 确认后续提交事项与时间', tags: ['庭审记录'], createdAt: dt(-2, '16:00'), updatedAt: dt(-1, '20:30') },
  { id: 'n13', caseId: 'case8', title: '检索工作记录模板', content: '## 检索记录\n- 登记检索问题与关键词\n- 记录公开来源与检索日期\n- 阅读全文后核对适用条件\n\n> 律师完成复核后记录结论', tags: ['法律研究'], createdAt: dt(-25, '11:30'), updatedAt: dt(-25, '11:30') },
  { id: 'n14', caseId: 'case9', title: '刑事委托材料清单', content: '- 核对委托手续\n- 记录已收到的文书\n- 安排阅卷与会见\n\n`待办：确认材料交接清单`', tags: ['策略'], createdAt: dt(-4, '17:00'), updatedAt: dt(-3, '09:20') },
  { id: 'n15', caseId: 'case10', title: '结案归档清单', content: '- [x] 登记文书目录\n- [x] 核对收费记录\n- [ ] 整理电子附件\n\n> 归档前确认资料齐全', tags: ['待办'], createdAt: dt(-32, '10:00'), updatedAt: dt(-9, '16:00') },
  { id: 'n16', caseId: 'case11', title: '仲裁事项履行核对', content: '- 对照裁决及履行凭证\n- 与客户确认款项\n- 登记尚待处理的事项', tags: ['客户沟通'], createdAt: dt(-12, '15:00'), updatedAt: dt(-12, '15:00') },
  { id: 'n17', caseId: 'case12', title: '流水核对清单', content: '- 按日期整理往来记录\n- 将凭证与主张逐项对应\n- 向客户丙核对差异', tags: ['证据梳理'], createdAt: dt(-6, '11:20'), updatedAt: dt(-6, '11:20') },
  { id: 'n18', caseId: 'case13', title: '评估事项跟进', content: '- 登记机构联络信息\n- 记录材料提交情况\n- 确认现场安排与反馈', tags: ['执行', '待办'], createdAt: dt(-9, '14:30'), updatedAt: dt(-2, '10:40') },
  { id: 'n19', caseId: 'case13', title: '财产线索登记模板', content: '## 线索登记\n- 记录来源、取得日期与材料位置\n- 核实权属及现状\n\n## 后续事项\n- 建立补充调查清单\n- 更新案件进度', tags: ['执行', '证据梳理'], createdAt: dt(-40, '09:00'), updatedAt: dt(-20, '16:10') },
  { id: 'n20', caseId: 'case2', title: '律师会见记录模板', content: '## 记录要点\n- 记录当事人陈述\n- 区分已核实事实与待核实事项\n- 登记需要补充的材料\n\n> 法律分析由律师结合材料另行完成', tags: ['法律研究', '策略'], createdAt: dt(-11, '20:00'), updatedAt: dt(-11, '20:00') },
]

export const preservations: Preservation[] = [
  { id: 'p1', caseId: 'case3', type: '财产保全', deadline: d(5), status: '生效', note: '冻结对方银行账户及股权，到期前办理续封。' },
  { id: 'p2', caseId: 'case3', type: '证据保全', deadline: d(26), status: '生效', note: '演示事项：登记证据材料存放位置及核对进度。' },
  { id: 'p3', caseId: 'case7', type: '财产保全', deadline: d(3), status: '生效', note: '冻结基本账户，余额不足，待追加查封车辆。' },
  { id: 'p4', caseId: 'case6', type: '查封扣押', deadline: d(-8), status: '生效', note: '冻结保险公司账户 120 万元，冻结期限已过，立即办理续冻。' },
  { id: 'p5', caseId: 'case13', type: '查封扣押', deadline: d(12), status: '生效', note: '示例区域办公房产查封，评估程序进行中。' },
  { id: 'p6', caseId: 'case9', type: '财产保全', deadline: null, status: '申请', note: '非吸案拟申请冻结涉案账户，申请材料准备中。' },
  { id: 'p7', caseId: 'case1', type: '财产保全', deadline: d(75), status: '生效', note: '冻结对方支付宝及银行账户合计约 30 万元。' },
  { id: 'p8', caseId: 'case8', type: '证据保全', deadline: d(-35), status: '结束', note: '侵权图书印刷记录公证保全已完成并存档。' },
  { id: 'p9', caseId: 'case12', type: '财产保全', deadline: d(7), status: '生效', note: '冻结被告工资账户，留意到期续冻。' },
  { id: 'p10', caseId: 'case10', type: '查封扣押', deadline: d(-90), status: '结束', note: '调解履行完毕后已解除查封。' },
]

export const events: CalendarEvent[] = [
  { id: 'e1', title: '会见客户丙（职务侵占案）', type: '会见', caseId: 'case2', start: dt(0, '09:30'), end: dt(0, '10:30'), location: '示例地点-01', reminder: '提前 1 天' },
  { id: 'e2', title: '公司甲法务来访（案件进展沟通）', type: '会见', caseId: 'case3', start: dt(0, '14:00'), end: dt(0, '15:00'), location: '示例地点-02', reminder: '提前 30 分钟' },
  { id: 'e3', title: '行政处罚案答辩状提交截止', type: '截止期限', caseId: 'case5', start: dt(0, '17:00'), end: dt(0, '17:30'), location: '示例地点-03', reminder: '当天 09:00' },
  { id: 'e4', title: '公司丙诉公司庚案开庭', type: '开庭', caseId: 'case8', start: dt(1, '09:00'), end: dt(1, '11:30'), location: '示例地点-04', reminder: '提前 1 天' },
  { id: 'e5', title: '客户甲诉对方甲案第三次开庭', type: '开庭', caseId: 'case1', start: dt(2, '10:00'), end: dt(2, '12:00'), location: '示例地点-05', reminder: '提前 1 天' },
  { id: 'e6', title: '会见客户丙（非吸案，第一次会见）', type: '会见', caseId: 'case9', start: dt(4, '13:30'), end: dt(4, '15:00'), location: '示例地点-06', reminder: '提前 1 天' },
  { id: 'e7', title: '保险合同纠纷执行款划扣申请截止', type: '截止期限', caseId: 'case6', start: dt(6, '17:00'), end: dt(6, '17:30'), location: '示例地点-07', reminder: '提前 1 天' },
  { id: 'e8', title: '客户丙诉对方乙案开庭', type: '开庭', caseId: 'case12', start: dt(8, '14:00'), end: dt(8, '16:00'), location: '示例地点-08', reminder: '提前 1 天' },
  { id: 'e9', title: '职务侵占案开庭', type: '开庭', caseId: 'case2', start: dt(12, '09:30'), end: dt(12, '12:00'), location: '示例地点-09', reminder: '提前 2 天' },
  { id: 'e10', title: '行政处罚案举证期限届满', type: '截止期限', caseId: 'case5', start: dt(15, '17:00'), end: dt(15, '17:30'), location: '示例地点-10', reminder: '提前 1 天' },
  { id: 'e11', title: '公司乙仲裁案开庭', type: '开庭', caseId: 'case4', start: dt(20, '09:00'), end: dt(20, '17:00'), location: '示例地点-11', reminder: '提前 3 天' },
  { id: 'e12', title: '客户甲诉对方甲案第二次开庭', type: '开庭', caseId: 'case1', start: dt(-14, '10:00'), end: dt(-14, '12:00'), location: '示例地点-12', reminder: '已结束' },
  { id: 'e13', title: '与公司甲比对报告讨论会', type: '会见', caseId: 'case3', start: dt(-3, '15:00'), end: dt(-3, '16:30'), location: '示例地点-13', reminder: '已结束' },
  { id: 'e14', title: '律所部门例会', type: '其他', caseId: null, start: dt(1, '18:30'), end: dt(1, '19:30'), location: '示例地点-14', reminder: '提前 15 分钟' },
  { id: 'e15', title: '非吸案第一次开庭', type: '开庭', caseId: 'case9', start: dt(25, '09:30'), end: dt(25, '17:00'), location: '示例地点-15', reminder: '提前 3 天' },
  { id: 'e16', title: '著作权案财产保全续封申请截止', type: '截止期限', caseId: 'case3', start: dt(30, '17:00'), end: dt(30, '17:30'), location: '示例地点-16', reminder: '提前 3 天' },
  { id: 'e17', title: '公司丁案管辖权异议答辩截止', type: '截止期限', caseId: 'case7', start: dt(-7, '17:00'), end: dt(-7, '17:30'), location: '示例地点-17', reminder: '已结束' },
  { id: 'e18', title: '提交非吸案阅卷申请', type: '其他', caseId: 'case9', start: dt(3, '10:00'), end: dt(3, '11:00'), location: '示例地点-18', reminder: '当天 08:30' },
]

export const todos: Todo[] = [
  { id: 't1', title: '联系公司甲确认续封担保函', caseId: 'case3', done: false, deadline: d(2), createdAt: dt(-2, '09:10') },
  { id: 't2', title: '起草行政处罚案代理词初稿', caseId: 'case5', done: false, deadline: d(6), createdAt: dt(-1, '15:30') },
  { id: 't3', title: '催促示例法院执行部门划扣进度（客户乙案）', caseId: 'case6', done: false, deadline: d(-3), createdAt: dt(-6, '10:00') },
  { id: 't4', title: '整理非吸案阅卷清单并复印卷宗', caseId: 'case9', done: false, deadline: d(10), createdAt: dt(-3, '14:20') },
  { id: 't5', title: '预约示例看守所会见时间', caseId: 'case2', done: false, deadline: null, createdAt: dt(-2, '11:00') },
  { id: 't6', title: '更新律师执业年度考核材料', caseId: null, done: false, deadline: d(18), createdAt: dt(-4, '16:40') },
  { id: 't7', title: '装订客户甲装修案卷宗并归档', caseId: 'case10', done: true, deadline: d(-5), createdAt: dt(-12, '09:30') },
  { id: 't8', title: '向公司甲寄送仲裁案结案报告', caseId: 'case11', done: true, deadline: null, createdAt: dt(-15, '13:00') },
  { id: 't9', title: '评估公司己案恢复执行线索并准备申请材料', caseId: 'case13', done: false, deadline: d(10), createdAt: dt(-1, '09:00') },
]

/** 演示附件来自旧版元数据，未携带真实文件；空路径用于明确标识不可打开。 */
const legacyFile = (value: Omit<FileMeta, 'storedName' | 'relPath'>): FileMeta => ({
  ...value,
  storedName: '',
  relPath: '',
})

export const contracts: Contract[] = [
  // 客户甲：买卖合同纠纷一审，固定收费两期，尾款逾期未收
  {
    id: 'ct1', contractNo: 'DEMO-CONTRACT-001', clientId: 'c1', caseIds: ['case1'],
    signedAt: d(-125), feeMode: '固定收费', totalFee: 80000, status: '履行中',
    files: [
      legacyFile({ id: 'f1', name: '委托代理合同-客户甲-扫描件.pdf', size: 2457600, uploadedAt: dt(-125, '10:30') }),
      legacyFile({ id: 'f2', name: '授权委托书-客户甲.pdf', size: 614400, uploadedAt: dt(-125, '10:31') }),
    ],
    note: '两期收费：签约付 50%，一审判决后付尾款。',
  },
  // 公司甲：一份合同覆盖诉讼 + 诉前组合（一合同多案件）
  {
    id: 'ct2', contractNo: 'DEMO-CONTRACT-002', clientId: 'c5', caseIds: ['case3', 'case15'],
    signedAt: d(-65), feeMode: '半风险代理', totalFee: 300000, status: '履行中',
    files: [
      legacyFile({ id: 'f3', name: '委托代理合同-公司甲.pdf', size: 3145728, uploadedAt: dt(-65, '14:00') }),
    ],
    note: '基础费用 10 万 + 胜诉/回款提成 5%；覆盖著作权侵权诉讼及公司子诉前谈判。',
  },
  // 公司乙：仲裁 + 执行打包，风险代理
  {
    id: 'ct3', contractNo: 'DEMO-CONTRACT-003', clientId: 'c6', caseIds: ['case4', 'case13'],
    signedAt: d(-155), feeMode: '风险代理', totalFee: 1200000, status: '履行中',
    files: [
      legacyFile({ id: 'f4', name: '委托代理合同-公司乙.pdf', size: 2097152, uploadedAt: dt(-155, '09:20') }),
      legacyFile({ id: 'f5', name: '风险代理告知书-公司乙.pdf', size: 409600, uploadedAt: dt(-155, '09:21') }),
    ],
    note: '纯风险：按实际回款 8% 计提，封顶 120 万；仲裁与执行程序合并委托。',
  },
  // 客户丙：民间借贷，固定收费已收讫（完成态演示）
  {
    id: 'ct4', contractNo: 'DEMO-CONTRACT-004', clientId: 'c3', caseIds: ['case12'],
    signedAt: d(-58), feeMode: '固定收费', totalFee: 20000, status: '履行中',
    files: [
      legacyFile({ id: 'f6', name: '委托代理合同-客户丙.pdf', size: 1572864, uploadedAt: dt(-58, '16:10') }),
    ],
    note: '一次性收费，已全额收取并开票。',
  },
]

export const fees: FeeRecord[] = [
  // ct1 两期：首期已收，尾款逾期
  { id: 'fee1', contractId: 'ct1', label: '首期款', amount: 40000, dueDate: d(-120), receivedAmount: 40000, receivedAt: d(-118), note: '对公转账' },
  { id: 'fee2', contractId: 'ct1', label: '尾款', amount: 40000, dueDate: d(-10), receivedAmount: 0, receivedAt: '', note: '客户称资金紧张，已电话催收两次' },
  // ct2 半风险：基础费分两期，首期已收、二期部分收
  { id: 'fee3', contractId: 'ct2', label: '基础费首期', amount: 50000, dueDate: d(-60), receivedAmount: 50000, receivedAt: d(-58), note: '' },
  { id: 'fee4', contractId: 'ct2', label: '基础费二期', amount: 50000, dueDate: d(10), receivedAmount: 20000, receivedAt: d(-2), note: '部分到账，余款约定开庭前付清' },
  // ct3 纯风险：暂无应收期次，回款后计提
  // ct4 一次性：已收讫
  { id: 'fee5', contractId: 'ct4', label: '全额律师费', amount: 20000, dueDate: d(-55), receivedAmount: 20000, receivedAt: d(-55), note: '现金缴存律所账户' },
]

export const invoices: Invoice[] = [
  {
    id: 'inv1', contractId: 'ct1', invoiceNo: 'DEMO-INVOICE-001', kind: '增值税普通发票',
    amount: 40000, issuedAt: d(-117),
    files: [legacyFile({ id: 'f7', name: '发票-DEMO-INVOICE-001.pdf', size: 204800, uploadedAt: dt(-117, '11:00') })],
    note: '首期款发票已交付客户',
  },
  {
    id: 'inv2', contractId: 'ct2', invoiceNo: 'DEMO-INVOICE-002', kind: '增值税专用发票',
    amount: 50000, issuedAt: d(-57),
    files: [legacyFile({ id: 'f8', name: '发票-DEMO-INVOICE-002.pdf', size: 189440, uploadedAt: dt(-57, '15:40') })],
    note: '专票寄送公司甲财务部',
  },
  {
    id: 'inv3', contractId: 'ct4', invoiceNo: 'DEMO-INVOICE-003', kind: '增值税普通发票',
    amount: 20000, issuedAt: d(-54),
    files: [legacyFile({ id: 'f9', name: '发票-DEMO-INVOICE-003.pdf', size: 196608, uploadedAt: dt(-54, '10:05') })],
    note: '',
  },
]

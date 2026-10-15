import type { Case, Client, Contract } from '../types'

/** 合同名称由关联案件或客户生成，与合同列表及搜索结果共用。 */
export function contractDisplayName(contract: Contract, getCase: (id: string) => Case | undefined, getClient: (id: string) => Client | undefined): string {
  const linkedCases = contract.caseIds.map(getCase).filter((value) => value !== undefined)
  if (linkedCases.length === 1) return `${linkedCases[0].title}委托代理合同`
  if (linkedCases.length > 1) return `${linkedCases[0].title}等${linkedCases.length}案委托代理合同`
  const clientName = getClient(contract.clientId)?.name
  return clientName ? `${clientName}委托代理合同` : '委托代理合同'
}

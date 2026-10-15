import { createContext, useContext } from 'react'

// 基础按钮只依赖这个轻量上下文，避免组件与 Store 的循环依赖。
export const MutationStateContext = createContext(false)
export const useMutationDisabled = () => useContext(MutationStateContext)

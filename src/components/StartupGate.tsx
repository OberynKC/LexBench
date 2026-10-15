import { useState } from 'react'
import { Database, LoaderCircle, MonitorX, TriangleAlert } from 'lucide-react'
import type { InitialSetupPayload } from '../types/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { FormField } from './ui/label'
import { Card, CardContent } from './ui/card'

export type StartupGateMode = 'loading' | 'setup' | 'initializing' | 'recovering' | 'error' | 'browser'

interface Props {
  mode: StartupGateMode
  message?: string
  /** 测试模式决定初始化页是否展示「导入演示数据」选项 */
  testMode?: boolean
  onInitialize?: (payload: InitialSetupPayload) => void
  onRetry?: () => void
}

export function StartupGate({ mode, message, testMode, onInitialize, onRetry }: Props) {
  const loading = mode === 'loading' || mode === 'initializing' || mode === 'recovering'
  const Icon = mode === 'browser' ? MonitorX : mode === 'error' ? TriangleAlert : Database
  const [surname, setSurname] = useState('')
  const [givenName, setGivenName] = useState('')
  const [wantDemo, setWantDemo] = useState(false)

  const title =
    mode === 'setup'
      ? '首次使用律衡'
      : mode === 'browser'
        ? '请在 Electron 中运行'
        : mode === 'error'
          ? '本地数据库暂不可用'
          : mode === 'recovering'
            ? '正在恢复本地数据'
            : mode === 'initializing'
              ? '正在初始化本地数据库'
              : '正在加载本地数据'

  const description =
    message ??
    (mode === 'setup'
      ? '数据库已创建。请填写您的姓名，即可开始使用律衡。'
      : mode === 'browser'
        ? '本地数据功能需要 Electron preload 提供的安全接口，请使用 npm run dev 启动应用。'
        : '请稍候，律衡正在连接本机 SQLite 数据库。')

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center px-8 py-9 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-800/[0.08] dark:bg-navy-900/50">
            {loading ? (
              <LoaderCircle className="h-6 w-6 animate-spin text-navy-700 dark:text-navy-200" />
            ) : (
              <Icon className="h-6 w-6 text-navy-700 dark:text-navy-200" />
            )}
          </div>
          <h1 className="mt-4 text-base font-semibold text-ink">{title}</h1>
          <p className="mt-2 max-w-md text-[13px] leading-6 text-ink-3">{description}</p>

          {mode === 'setup' && (
            <div className="mt-6 flex w-full flex-col gap-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="姓" required>
                  <Input
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    placeholder="如 王"
                    autoFocus
                  />
                </FormField>
                <FormField label="名">
                  <Input
                    value={givenName}
                    onChange={(e) => setGivenName(e.target.value)}
                    placeholder="如 建国"
                  />
                </FormField>
              </div>
              {testMode && (
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    checked={wantDemo}
                    onChange={(e) => setWantDemo(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-navy-700"
                  />
                  同时导入演示数据
                </label>
              )}
              <Button
                className="mt-2 w-full"
                disabled={!surname.trim()}
                onClick={() =>
                  onInitialize?.({ userName: surname.trim(), userGivenName: givenName.trim(), mode: wantDemo ? 'demo' : 'blank' })
                }
              >
                开始使用
              </Button>
            </div>
          )}
          {mode === 'error' && (
            <Button className="mt-6" onClick={onRetry}>重试连接</Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

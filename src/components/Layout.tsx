import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Scale,
  LayoutDashboard,
  ListTodo,
  Briefcase,
  NotebookPen,
  ShieldCheck,
  CalendarDays,
  Users,
  Search,
  Moon,
  Sun,
  Settings,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useStore } from '../store'
import { SettingsDialog } from './SettingsDialog'
import { GlobalSearch } from './GlobalSearch'
import { ReminderCenter } from './ReminderCenter'

const navGroups: { label: string; items: { to: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: '工作台',
    items: [
      { to: '/', label: '仪表盘', icon: LayoutDashboard },
      { to: '/cases', label: '案件管理', icon: Briefcase },
      { to: '/calendar', label: '日程表', icon: CalendarDays },
      { to: '/todos', label: '待办事项', icon: ListTodo },
      { to: '/preservations', label: '保全执行', icon: ShieldCheck },
      { to: '/notes', label: '办案笔记', icon: NotebookPen },
    ],
  },
  {
    label: '业务资料',
    items: [
      { to: '/clients', label: '客户管理', icon: Users },
      { to: '/contracts', label: '合同管理', icon: FileText },
    ],
  },
]

const titleMap: [RegExp, string][] = [
  [/^\/todos$/, '待办事项'],
  [/^\/cases\/[^/]+$/, '案件详情'],
  [/^\/cases$/, '案件管理'],
  [/^\/notes$/, '办案笔记'],
  [/^\/preservations$/, '保全执行'],
  [/^\/calendar$/, '日程表'],
  [/^\/clients\/[^/]+$/, '客户详情'],
  [/^\/clients$/, '客户管理'],
  [/^\/contracts\/[^/]+$/, '合同详情'],
  [/^\/contracts$/, '合同管理'],
]

/** 按当前时段生成问候语 */
function greeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return '早上好'
  if (h >= 11 && h < 13) return '中午好'
  if (h >= 13 && h < 18) return '下午好'
  if (h >= 18 && h < 23) return '晚上好'
  return '夜深了'
}

// macOS 使用内嵌红绿灯（main.ts 的 titleBarStyle: hiddenInset），需要预留拖拽与按钮安全区
const isMac = /Mac/i.test(navigator.platform)

function useDarkMode() {
  // 无本地记录时跟随系统外观；用户手动切换后以本地记录为准
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('lex-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('lex-theme', dark ? 'dark' : 'light')
  }, [dark])
  return { dark, toggle: () => setDark((v) => !v) }
}

/** 顶部栏图标按钮的统一样式（提醒中心触发器复用同一规格） */
export const headerIconButtonClass =
  'flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink'

export default function Layout() {
  const location = useLocation()
  const { dark, toggle } = useDarkMode()
  const { state, readOnly } = useStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const searchShortcut = isMac ? '⌘ K' : 'Ctrl K'

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || event.altKey) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const userName = state.userName.trim()
  const givenName = state.userGivenName.trim()
  const fullName = `${userName}${givenName}`
  const title =
    location.pathname === '/'
      ? `${greeting()}，${userName ? `${userName}律师` : '沈律师'}`
      : titleMap.find(([re]) => re.test(location.pathname))?.[1] ?? '律衡'
  const avatarName = fullName || '沈知行'
  const avatarLetter = (userName || '沈').charAt(0)

  return (
    <div className="flex h-screen overflow-hidden bg-base text-ink">
      {/* 左侧导航 */}
      <aside className="flex w-[212px] shrink-0 flex-col border-r border-line-1 bg-sidebar">
        {/* macOS 红绿灯安全区与拖拽条；Windows 无此区域 */}
        {isMac && <div className="app-drag h-[34px] shrink-0" />}
        <div className={cn('flex shrink-0 items-center gap-2.5 px-4', isMac ? 'h-11' : 'h-14')}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-navy-800">
            <Scale className="h-4 w-4 text-amber-300" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[15px] font-semibold tracking-wide text-ink">律衡</div>
            <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-ink-4">LexBench</div>
          </div>
        </div>
        <nav className="mt-1 flex-1 overflow-y-auto px-2 pb-2">
          {navGroups.map((group) => (
            <div key={group.label} className="pt-3 first:pt-1">
              <div className="px-2.5 pb-1 text-[11px] font-medium text-ink-4">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors',
                        isActive
                          ? 'bg-navy-800/[0.08] font-medium text-navy-900 dark:bg-navy-300/15 dark:text-navy-100'
                          : 'text-ink-2 hover:bg-hover hover:text-ink',
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line-1 p-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink"
          >
            <Settings className="h-4 w-4 shrink-0" />
            设置
          </button>
        </div>
      </aside>

      {/* 右侧主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶部栏：macOS 下整体可拖拽，控件区排除 */}
        <header
          className={cn(
            'flex h-12 shrink-0 items-center gap-3 border-b border-line-1 px-5',
            isMac && 'app-drag',
          )}
        >
          <h1 className="min-w-0 truncate text-[15px] font-semibold text-ink">{title}</h1>
          <div className={cn('ml-auto flex items-center gap-2', isMac && 'app-no-drag')}>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="打开全局搜索"
              aria-haspopup="dialog"
              className="flex h-7 items-center gap-2 rounded-md border border-line-2 bg-field px-2.5 text-xs text-ink-4 outline-none transition-colors hover:border-line-3 hover:text-ink-3 focus-visible:border-navy-400 focus-visible:ring-2 focus-visible:ring-navy-400/40 md:w-56"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden md:block">搜索案件 / 客户等</span>
              <kbd className="ml-auto hidden rounded border border-line-2 px-1 text-[10px] md:block">{searchShortcut}</kbd>
            </button>
            <ReminderCenter />
            <button
              onClick={toggle}
              className={headerIconButtonClass}
              aria-label="切换明暗主题"
              title={dark ? '切换到浅色' : '切换到深色'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 border-l border-line-2 pl-2.5">
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-navy-700 text-[11px] font-medium text-white">
                {avatarLetter}
              </div>
              <div className="hidden text-xs font-medium text-ink-2 lg:block">{avatarName} 律师</div>
            </div>
          </div>
        </header>

        {readOnly && (
          <div
            role="status"
            className="border-b border-amber-200 bg-amber-50 px-5 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            正在准备或执行导出、备份或恢复，暂时不能保存、上传或删除；可以继续查看。
          </div>
        )}
        {/* 主内容 */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {searchOpen && <GlobalSearch onClose={closeSearch} />}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useStore } from '../store'
import { cn } from '../lib/utils'
import { highlightParts, searchAppState, searchTokens, type SearchResult } from '../lib/globalSearch'
import { Dialog } from './ui/dialog'
import { Input } from './ui/input'
import { Badge } from './ui/badge'

function Highlight({ value, tokens }: { value: string; tokens: string[] }) {
  return <>{highlightParts(value, tokens).map((part, index) => part.matched
    ? <mark key={index} className="rounded-sm bg-amber-100 text-inherit dark:bg-amber-900/60">{part.text}</mark>
    : <span key={index}>{part.text}</span>)}</>
}

/** 打开时挂载，关闭时清空关键词并归还焦点。 */
export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { state } = useStore()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const tokens = useMemo(() => searchTokens(debouncedQuery), [debouncedQuery])
  const groups = useMemo(() => searchAppState(state, tokens), [state, tokens])
  const results = useMemo(() => groups.flatMap((group) => group.items), [groups])
  const activeIndex = Math.max(0, results.findIndex((result) => result.key === activeKey))
  const active = results[activeIndex]
  const pending = query !== debouncedQuery

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query)
      setActiveKey(null)
      listRef.current?.scrollTo({ top: 0 })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return
      // 搜索叠加在编辑弹窗上时，Esc 只关闭最上层搜索。
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
      }
      if (event.key === 'Tab') {
        const dialog = inputRef.current?.closest('[role="dialog"]')
        const controls = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
        if (!controls?.length) return
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey, true)
      if (previous?.isConnected) previous.focus()
    }
  }, [onClose])

  useEffect(() => {
    if (!pending) document.getElementById(`search-result-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, active?.key, pending])

  const openResult = (result: SearchResult) => {
    onClose()
    navigate(result.to)
  }
  const onSearchKey = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || !results.length || pending) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveKey(results[(activeIndex + delta + results.length) % results.length].key)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      openResult(active)
    }
  }

  return (
    <Dialog open onClose={onClose} title="全局搜索" className="max-w-2xl"
      footer={<p className="mr-auto text-xs text-ink-4">↑↓ 选择 · Enter 打开 · Esc 关闭</p>}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
        <Input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKey} placeholder="搜索案件、客户、合同、笔记、待办、日程、保全"
          className="pl-8" aria-label="全局搜索关键词" role="combobox" aria-autocomplete="list"
          aria-expanded={results.length > 0 && !pending} aria-controls="global-search-results"
          aria-activedescendant={active && !pending ? `search-result-${activeIndex}` : undefined} />
      </div>
      <div ref={listRef} id="global-search-results" role="listbox" aria-label="搜索结果"
        aria-busy={pending} className="mt-3 max-h-[50vh] overflow-y-auto" onKeyDown={onSearchKey}>
        {!query.trim() ? <p role="status" className="py-10 text-center text-sm text-ink-3">输入关键词开始搜索，多个词用空格分隔</p>
          : pending ? <p role="status" className="py-10 text-center text-sm text-ink-3">正在搜索…</p>
          : !results.length ? <p role="status" className="py-10 text-center text-sm text-ink-3">没有找到匹配的结果，请尝试其他关键词</p>
          : groups.map((group) => (
            <div key={group.label} role="group" aria-label={group.label} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between px-2 py-1.5 text-xs text-ink-3">
                <span>{group.label}</span>
                {group.total > group.items.length && <span>共 {group.total} 条</span>}
              </div>
              {group.items.map((result) => {
                const index = results.indexOf(result)
                return <button key={result.key} id={`search-result-${index}`} type="button" role="option"
                  aria-selected={index === activeIndex} onMouseEnter={() => setActiveKey(result.key)}
                  onFocus={() => setActiveKey(result.key)} onClick={() => openResult(result)}
                  className={cn('block w-full rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400',
                    index === activeIndex ? 'bg-navy-50 dark:bg-navy-950/60' : 'hover:bg-hover')}>
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="gray" className="shrink-0">{group.label}</Badge>
                    <span className="truncate text-sm font-medium text-ink"><Highlight value={result.title} tokens={tokens} /></span>
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-3"><Highlight value={result.secondary} tokens={tokens} /></p>
                  {result.snippet && <p className="mt-1 break-words text-xs leading-relaxed text-ink-2"><Highlight value={result.snippet} tokens={tokens} /></p>}
                </button>
              })}
            </div>
          ))}
      </div>
    </Dialog>
  )
}

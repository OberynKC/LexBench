import { Fragment, type ReactNode } from 'react'
import { cn } from './utils'

/**
 * 极轻量 Markdown 渲染器：支持 # 标题、**粗体**、*斜体*、`行内代码`、
 * - 无序列表、1. 有序列表、- [ ]/- [x] 任务列表、> 引用、--- 分隔线。
 */

function renderInline(text: string): ReactNode[] {
  // 依次切分 `code`、**bold**、*italic*
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|- \[[ x]\])/g)
  return tokens.map((token, i) => {
    if (!token) return null
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-hover px-1 py-0.5 font-mono text-[0.85em] text-navy-700 dark:text-navy-300">
          {token.slice(1, -1)}
        </code>
      )
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      )
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return <em key={i}>{token.slice(1, -1)}</em>
    }
    return <Fragment key={i}>{token}</Fragment>
  })
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: ReactNode[] } | null = null
  let key = 0

  const flushList = () => {
    if (!list) return
    const items = list.items
    blocks.push(
      list.ordered ? (
        <ol key={key++} className="my-2 list-decimal space-y-1 pl-6">
          {items}
        </ol>
      ) : (
        <ul key={key++} className="my-2 list-disc space-y-1 pl-6">
          {items}
        </ul>
      ),
    )
    list = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const taskMatch = line.match(/^\s*- \[([ x])\] (.*)$/)
    const ulMatch = !taskMatch && line.match(/^\s*- (.*)$/)
    const olMatch = line.match(/^\s*\d+\. (.*)$/)
    const heading = line.match(/^(#{1,4}) (.*)$/)

    if (taskMatch || ulMatch || olMatch) {
      const ordered = !!olMatch
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      if (taskMatch) {
        const checked = taskMatch[1] === 'x'
        list.items.push(
          <li key={key++} className="list-none -ml-4 flex items-center gap-2">
            <input type="checkbox" checked={checked} readOnly className="h-3.5 w-3.5 accent-navy-700" />
            <span className={checked ? 'text-ink-4 line-through' : undefined}>{renderInline(taskMatch[2])}</span>
          </li>,
        )
      } else {
        list.items.push(<li key={key++}>{renderInline((ulMatch || olMatch)![1])}</li>)
      }
      continue
    }

    flushList()

    if (!line.trim()) {
      continue
    }
    if (heading) {
      const level = heading[1].length
      const cls =
        level === 1
          ? 'mb-3 mt-4 text-xl font-bold'
          : level === 2
            ? 'mb-2 mt-4 text-lg font-semibold'
            : 'mb-2 mt-3 text-base font-semibold'
      blocks.push(
        <div key={key++} className={cls}>
          {renderInline(heading[2])}
        </div>,
      )
    } else if (line.startsWith('> ')) {
      blocks.push(
        <blockquote key={key++} className="my-2 border-l-2 border-navy-300 pl-3 text-ink-3">
          {renderInline(line.slice(2))}
        </blockquote>,
      )
    } else if (line === '---') {
      blocks.push(<hr key={key++} className="my-3 border-line-2" />)
    } else {
      blocks.push(<p key={key++} className="my-1.5 leading-relaxed">{renderInline(line)}</p>)
    }
  }
  flushList()

  return <div className={cn('text-sm text-ink', className)}>{blocks}</div>
}

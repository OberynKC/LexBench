import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { useMutationDisabled } from '../../lib/mutationState'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

/**
 * 操作层级：default 为每个区域唯一主操作；secondary 为次操作浅底；
 * outline 用于表单内一般动作；ghost 用于工具栏与密集列表；destructive 为危险操作；link 为行间链接。
 */
const variants: Record<ButtonVariant, string> = {
  default:
    'bg-navy-800 text-white hover:bg-navy-700 active:bg-navy-900 dark:bg-navy-700 dark:hover:bg-navy-600 dark:active:bg-navy-800',
  secondary: 'bg-active text-ink hover:bg-hover',
  outline: 'border border-line-2 bg-surface text-ink-2 hover:bg-hover hover:text-ink',
  ghost: 'text-ink-2 hover:bg-hover hover:text-ink',
  destructive: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
  link: 'text-navy-700 underline-offset-4 hover:underline dark:text-navy-300',
}

const sizes: Record<ButtonSize, string> = {
  default: 'h-8 gap-1.5 rounded-md px-3.5 text-[13px]',
  sm: 'h-7 gap-1.5 rounded-md px-2.5 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5',
  lg: 'h-9 gap-2 rounded-md px-4 text-sm',
  icon: 'h-8 w-8 rounded-md',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  mutation?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', mutation = false, disabled, ...props }, ref) => {
    const readOnly = useMutationDisabled()
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900',
          'disabled:pointer-events-none disabled:opacity-50',
          '[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled || (mutation && readOnly)}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

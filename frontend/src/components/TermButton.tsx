import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type TermButtonVariant =
  | 'primary'
  | 'tag'
  | 'danger'
  | 'success'
  | 'os'
  | 'arch'
  | 'cyan'
  | 'image'
  | 'purple'
  | 'index'
  | 'neutral'
  | 'dim'

const variantClasses: Record<TermButtonVariant, string> = {
  primary:
    'border-sky-500/40 bg-sky-500/10 text-sky-300 hover:border-sky-400 hover:bg-sky-500/20 hover:text-sky-200 active:bg-sky-500/30',
  tag:
    'border-sky-500/40 bg-sky-500/10 text-sky-300 hover:border-sky-400 hover:bg-sky-500/20 hover:text-sky-200 active:bg-sky-500/30',
  danger:
    'border-red-500/40 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20 hover:text-red-300 active:bg-red-500/30',
  success:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-200 active:bg-emerald-500/30',
  os:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-200 active:bg-emerald-500/30',
  arch:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-200 active:bg-emerald-500/30',
  cyan:
    'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-200 active:bg-cyan-500/30',
  image:
    'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-200 active:bg-cyan-500/30',
  purple:
    'border-purple-500/40 bg-purple-500/15 text-purple-300 hover:border-purple-400 hover:bg-purple-500/25 hover:text-purple-200 active:bg-purple-500/35',
  index:
    'border-purple-500/40 bg-purple-500/15 text-purple-300 hover:border-purple-400 hover:bg-purple-500/25 hover:text-purple-200 active:bg-purple-500/35',
  neutral:
    'border-zinc-700/80 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 active:bg-zinc-700',
  dim:
    'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200 active:bg-zinc-800',
}

export default function TermButton({
  children,
  danger,
  variant,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode
  danger?: boolean
  variant?: TermButtonVariant
}) {
  const chosenVariant: TermButtonVariant = danger
    ? 'danger'
    : (variant ?? 'primary')

  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer select-none items-center justify-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium leading-normal uppercase tracking-[0.08em] transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${
        variantClasses[chosenVariant]
      } ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  )
}


import type { ButtonHTMLAttributes } from 'react'

export default function TermButton({
  children,
  danger,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-[12px] uppercase tracking-[0.08em] transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        danger
          ? 'text-zinc-500 hover:bg-zinc-900 hover:text-red-400'
          : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100'
      } ${className ?? ''}`}
      {...props}
    >
      [ {children} ]
    </button>
  )
}

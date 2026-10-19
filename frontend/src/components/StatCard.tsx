import type { ReactNode } from 'react'

export default function StatCard({
  value,
  label,
  icon,
  sub,
  title,
}: {
  value: ReactNode
  label: string
  icon?: ReactNode
  sub?: ReactNode
  title?: string
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-4" title={title}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 truncate text-2xl font-bold tabular-nums text-white">{value}</div>
      {sub ? (
        <div className="mt-1 truncate text-[11px] text-zinc-600">{sub}</div>
      ) : null}
    </div>
  )
}

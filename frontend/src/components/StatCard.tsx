import type { ReactNode } from 'react'

export default function StatCard({
  icon,
  value,
  label,
  sub,
  title,
}: {
  icon: ReactNode
  value: ReactNode
  label: string
  sub?: ReactNode
  title?: string
}) {
  return (
    <div className="stat-card" title={title}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-value">{value}</div>
        <div className="stat-label">
          {label}
          {sub ? <span className="stat-sub"> · {sub}</span> : null}
        </div>
      </div>
    </div>
  )
}

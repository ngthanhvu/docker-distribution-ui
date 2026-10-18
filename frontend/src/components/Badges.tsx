import type { ReactNode } from 'react'
import type { PlatformSummary, TagInfo } from '../types'

export function Badge({
  children,
  variant,
  title,
}: {
  children: ReactNode
  variant?: 'os' | 'arch' | 'index' | 'image' | 'dim' | 'danger'
  title?: string
}) {
  return (
    <span className={`badge ${variant ? `b-${variant}` : ''}`} title={title}>
      {children}
    </span>
  )
}

export function KindBadge({ kind }: { kind: string }) {
  return kind === 'index' ? (
    <Badge variant="index" title="Multi-architecture image index">
      multi-arch
    </Badge>
  ) : (
    <Badge variant="image" title="Single-platform image">
      image
    </Badge>
  )
}

export function PlatformBadges({ p }: { p: PlatformSummary }) {
  const parts: string[] = []
  if (p.os) parts.push(p.os)
  if (p.architecture) parts.push(p.architecture)
  if (p.variant) parts.push(p.variant)
  if (parts.length === 0) return null
  const label = parts.join('/')
  return <Badge variant="os" title={label}>{label}</Badge>
}

export function TagPlatformCell({ tag }: { tag: TagInfo }) {
  if (tag.kind === 'index' && tag.platforms && tag.platforms.length > 0) {
    const shown = tag.platforms.slice(0, 3)
    const rest = tag.platforms.length - shown.length
    return (
      <span className="badges">
        {shown.map((p, i) => (
          <PlatformBadges key={i} p={p} />
        ))}
        {rest > 0 && <Badge variant="dim">+{rest}</Badge>}
      </span>
    )
  }
  const p: PlatformSummary = {
    os: tag.os,
    architecture: tag.architecture,
    variant: tag.variant,
  }
  return <PlatformBadges p={p} />
}

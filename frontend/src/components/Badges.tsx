import type { ReactNode } from 'react'
import type { PlatformSummary, TagInfo } from '../types'

const variantClasses: Record<string, string> = {
  tag: 'border-sky-500/40 bg-sky-500/10 text-sky-300 font-medium',
  os: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-medium',
  arch: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-medium',
  index: 'border-purple-500/40 bg-purple-500/15 text-purple-300 font-medium',
  image: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-medium',
  dim: 'border-zinc-800 bg-zinc-950 text-zinc-500',
  danger: 'border-red-500/40 bg-red-500/10 text-red-400 font-medium',
}

export function Badge({
  children,
  variant,
  title,
}: {
  children: ReactNode
  variant?: 'tag' | 'os' | 'arch' | 'index' | 'image' | 'dim' | 'danger'
  title?: string
}) {
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-px text-[11px] leading-5 transition-colors ${
        variant ? variantClasses[variant] : variantClasses.tag
      }`}
      title={title}
    >
      [{children}]
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
  return (
    <Badge variant="os" title={label}>
      {label}
    </Badge>
  )
}

export function TagPlatformCell({ tag }: { tag: TagInfo }) {
  if (tag.kind === 'index' && tag.platforms && tag.platforms.length > 0) {
    const shown = tag.platforms.slice(0, 3)
    const rest = tag.platforms.length - shown.length
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
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

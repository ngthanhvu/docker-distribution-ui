import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, useConfig } from '../api'
import { hostOf, shortDigest } from '../format'
import CopyButton from './CopyButton'
import TermButton from './TermButton'
import { Logo } from './icons'

type HealthState = 'up' | 'down' | 'unknown'

function repoPath(name: string): string {
  return encodeURIComponent(name)
}

export default function Layout({
  children,
  username,
  onLogout,
}: {
  children: ReactNode
  username?: string
  onLogout?: () => void
}) {
  const [health, setHealth] = useState<HealthState>('unknown')
  const cfg = useConfig()
  const { pathname } = useLocation()

  let repoName: string | undefined
  let tagRef: string | undefined

  if (pathname.startsWith('/repo/')) {
    const raw = pathname.slice('/repo/'.length)
    const segments = raw.split('/')
    if (segments.length >= 1 && segments[0]) {
      repoName = decodeURIComponent(segments[0])
    }
    if (segments.length >= 2 && segments[1]) {
      tagRef = decodeURIComponent(segments[1])
    }
  }

  useEffect(() => {
    let alive = true
    const check = () => {
      api
        .health()
        .then((h) => alive && setHealth(h.ok ? 'up' : 'down'))
        .catch(() => alive && setHealth('down'))
    }
    check()
    const timer = setInterval(check, 30000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const healthTitle =
    health === 'up'
      ? `Registry online (${cfg?.registryPublicUrl ?? ''})`
      : health === 'down'
        ? 'Registry unreachable'
        : 'Checking registry…'
  const healthLabel =
    health === 'up' ? 'Online' : health === 'down' ? 'Offline' : 'Checking…'
  const dotColor =
    health === 'up'
      ? 'text-emerald-400'
      : health === 'down'
        ? 'text-red-400'
        : 'text-zinc-500'

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <Logo size={20} className="shrink-0 text-zinc-400" />
            <span className="truncate text-[13px] font-bold tracking-[0.06em] text-white">
              DOCKER // REGISTRY
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {cfg && (
              <span
                className="hidden items-center gap-1 text-[12px] md:flex"
                title={cfg.registryPublicUrl}
              >
                <span className="text-zinc-600">HOST:</span>
                <span className="text-zinc-300">{hostOf(cfg.registryPublicUrl)}</span>
                <CopyButton text={cfg.registryPublicUrl} title="Copy registry URL" />
              </span>
            )}
            <span className="flex items-center gap-1.5 text-[12px]" title={healthTitle}>
              <span className={`text-[9px] leading-none ${dotColor}`}>●</span>
              <span className="text-zinc-500">{healthLabel}</span>
            </span>
            {username && (
              <span className="flex items-center gap-1.5">
                <span className="hidden items-center gap-1 text-[12px] sm:flex">
                  <span className="text-zinc-600">USER:</span>
                  <span className="max-w-35 truncate text-zinc-300">{username}</span>
                </span>
                <TermButton
                  onClick={() => {
                    api.auth.logout().catch(() => {})
                    onLogout?.()
                  }}
                >
                  LOGOUT
                </TermButton>
              </span>
            )}
          </div>
        </div>
        {repoName && (
          <div className="border-t border-zinc-900">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2 text-[12.5px] sm:px-6 lg:px-8">
              <Link
                to="/"
                className="text-zinc-500 transition-colors hover:text-zinc-100"
              >
                ~/repositories
              </Link>
              <span className="text-zinc-700">/</span>
              <Link
                to={`/repo/${repoPath(repoName)}`}
                className="max-w-[320px] truncate text-zinc-300 transition-colors hover:text-zinc-100"
              >
                {repoName}
              </Link>
              {tagRef && (
                <>
                  <span className="text-zinc-700">/</span>
                  <span className="max-w-55 truncate text-zinc-100">
                    {tagRef.startsWith('sha256:') ? shortDigest(tagRef) : tagRef}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-3 px-4 text-[11px] sm:px-6 lg:px-8">
          <span className="truncate uppercase tracking-[0.12em] text-zinc-100">
            Docker Distribution Registry{cfg?.version ? ` v${cfg.version}` : ''}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-zinc-100">
            <span className={`text-[9px] leading-none ${dotColor}`}>●</span>
            <span className="uppercase tracking-[0.12em]">
              {health === 'up' ? 'online' : health === 'down' ? 'offline' : 'checking…'}
            </span>
            {cfg?.registryPublicUrl && (
              <a
                href={cfg.registryPublicUrl}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-zinc-300"
              >
                {hostOf(cfg.registryPublicUrl)}
              </a>
            )}
          </span>
        </div>
      </footer>
    </div>
  )
}

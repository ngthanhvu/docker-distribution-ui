import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, useConfig } from '../api'
import { hostOf } from '../format'
import { Logo } from './icons'

type HealthState = 'up' | 'down' | 'unknown'

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

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <Logo />
            <span className="brand-name">
              Registry<em>UI</em>
            </span>
          </Link>
          <div className="header-meta">
            {cfg && (
              <span className="chip mono" title={cfg.registryPublicUrl}>
                {hostOf(cfg.registryPublicUrl)}
              </span>
            )}
            <span className={`health-dot health-${health}`} title={healthTitle} />
            {username && (
              <span className="header-user">
                <span className="chip mono" title={`Signed in as ${username}`}>
                  {username}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    api.auth.logout().catch(() => {})
                    onLogout?.()
                  }}
                >
                  Logout
                </button>
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="container main">{children}</main>
      <footer className="container footer">
        <span>
          Docker Distribution Registry UI{cfg?.version ? ` · v${cfg.version}` : ''}
        </span>
      </footer>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { AuthStatus } from '../api'
import { timeAgo } from '../format'
import { CaretIcon, LogoutIcon, UserIcon } from './icons'

export default function UserMenu({ username, onLogout }: { username: string; onLogout?: () => void }) {
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState<AuthStatus | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .auth.status()
      .then(setAccount)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const logout = () => {
    api.auth.logout().catch(() => {})
    onLogout?.()
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer select-none items-center gap-1.5 border border-transparent py-1 pl-2 pr-1.5 text-[12px] transition-colors hover:border-zinc-800 hover:bg-zinc-900/60"
        title="Account"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserIcon size={13} className="shrink-0 text-zinc-500" />
        <span className="max-w-35 truncate text-zinc-300">{username}</span>
        <CaretIcon
          size={10}
          className={`shrink-0 text-zinc-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 pt-1">
          <div className="w-60 border border-zinc-800 bg-zinc-950 py-1 shadow-xl shadow-black/50">
            <div className="border-b border-zinc-900 px-3 py-2.5">
              <div className="truncate text-[13px] font-bold text-white">{username}</div>
              <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                {account?.createdAt ? `admin · created ${timeAgo(account.createdAt)}` : 'admin'}
              </div>
              {account?.passwordUpdatedAt && (
                <div className="mt-0.5 truncate text-[11px] text-zinc-600">
                  password changed {timeAgo(account.passwordUpdatedAt)}
                </div>
              )}
            </div>
            <Link
              to="/profile"
              viewTransition
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              <UserIcon size={13} className="shrink-0 text-zinc-500" />
              Profile
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full cursor-pointer select-none items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-red-400/90 transition-colors hover:bg-zinc-900 hover:text-red-300"
            >
              <LogoutIcon size={13} className="shrink-0 text-red-400/60" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

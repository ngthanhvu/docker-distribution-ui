import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { AuthStatus } from '../api'
import { formatDate, timeAgo } from '../format'
import TermButton from '../components/TermButton'
import { KeyIcon, UserIcon } from '../components/icons'

const inputClass =
  'mt-1.5 w-full border border-zinc-800 bg-black px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-zinc-400 placeholder:text-zinc-600'
const labelClass = 'block text-[11px] uppercase tracking-[0.12em] text-zinc-500'

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-zinc-900 py-2.5 last:border-b-0">
      <div className="pt-0.5 text-[10.5px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      <div className="min-w-0 wrap-break-word text-[12.5px] text-zinc-300">{children}</div>
    </div>
  )
}

export default function Profile() {
  const [st, setSt] = useState<AuthStatus | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .auth.status()
      .then(setSt)
      .catch(() => setSt(null))
  }, [])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await api.auth.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setNotice('Password changed. All other sessions were signed out.')
      api
        .auth.status()
        .then(setSt)
        .catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-800 bg-zinc-950">
          <UserIcon size={16} className="text-zinc-400" />
        </span>
        <div className="min-w-0">
          <h1 className="m-0 break-all text-xl font-bold tracking-tight text-white">
            {st?.username || 'Account'}
          </h1>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-zinc-500">
            Admin account · web UI credentials
          </p>
        </div>
      </div>

      {st === null && (
        <div className="mb-4 border border-zinc-800 bg-zinc-950 px-4 py-3 text-[12.5px] text-zinc-500">
          Loading account info…
        </div>
      )}
      {st?.authDisabled && (
        <div className="border border-zinc-800 bg-zinc-950 px-4 py-3 text-[12.5px] text-zinc-500">
          Authentication is disabled (AUTH_DISABLED), there is no account to manage.
        </div>
      )}
      {st && !st.authDisabled && !st.authenticated && (
        <div className="mb-4 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-400">
          Session expired — log in again to manage the account.
        </div>
      )}

      {st && !st.authDisabled && st.authenticated && (
        <div className="grid items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <UserIcon size={13} className="text-zinc-500" />
              Account
            </h3>
            <div className="grid">
              <InfoRow label="Username">{st.username}</InfoRow>
              <InfoRow label="Created">
                <span title={formatDate(st.createdAt)}>{timeAgo(st.createdAt)}</span>
              </InfoRow>
              <InfoRow label="Pass changed">
                {st.passwordUpdatedAt ? (
                  <span title={formatDate(st.passwordUpdatedAt)}>
                    {timeAgo(st.passwordUpdatedAt)}
                  </span>
                ) : (
                  'never'
                )}
              </InfoRow>
              <InfoRow label="Storage">
                <code className="text-[11.5px] text-zinc-400">/data/auth.json (0600)</code>
              </InfoRow>
              <InfoRow label="Hash">
                PBKDF2-SHA256 · 600k iterations
              </InfoRow>
            </div>
            <p className="m-0 mt-3 text-[11.5px] leading-relaxed text-zinc-600">
              Forgot the password? Remove auth.json from the backend data volume and
              restart — the setup screen will come back.
            </p>
          </div>

          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <KeyIcon size={13} className="text-amber-400" />
              Change password
            </h3>
            {notice && (
              <div className="mb-4 border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-400">
                {notice}
              </div>
            )}
            {error && (
              <div className="mb-4 border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
                {error}
              </div>
            )}
            <form onSubmit={submit} className="max-w-md">
              <label className="mb-4 block">
                <span className={labelClass}>Current password</span>
                <input
                  type="password"
                  autoFocus
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={inputClass}
                />
              </label>
              <label className="mb-4 block">
                <span className={labelClass}>New password</span>
                <input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </label>
              <label className="mb-5 block">
                <span className={labelClass}>Confirm new password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </label>
              <TermButton type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Change password'}
              </TermButton>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

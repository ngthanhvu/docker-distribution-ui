import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import { Logo } from '../components/icons'

export default function SetupPage({ onDone }: { onDone: (username: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await api.auth.setup(username, password)
      onDone(res.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-5">
      <form className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-7" onSubmit={submit}>
        <div className="mb-4 flex justify-center">
          <Logo size={30} className="text-zinc-500" />
        </div>
        <h1 className="m-0 text-center text-lg font-bold text-white">Create Admin Account</h1>
        <p className="mt-1.5 mb-6 text-center text-[12px] text-zinc-500">
          Set up the admin account for your registry UI.
        </p>
        {error && (
          <div className="mb-4 border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
            {error}
          </div>
        )}
        <label className="mb-4 block">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            Username
          </span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={32}
            autoComplete="username"
            spellCheck={false}
            className="mt-1.5 w-full border border-zinc-800 bg-black px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-zinc-400 placeholder:text-zinc-600"
          />
        </label>
        <label className="mb-4 block">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1.5 w-full border border-zinc-800 bg-black px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-zinc-400 placeholder:text-zinc-600"
          />
        </label>
        <label className="mb-6 block">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            Confirm password
          </span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1.5 w-full border border-zinc-800 bg-black px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-zinc-400 placeholder:text-zinc-600"
          />
        </label>
        <button
          type="submit"
          className="w-full border border-zinc-300 bg-zinc-200 py-2.5 text-[13px] font-bold text-black transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-40"
          disabled={busy}
        >
          {busy ? 'Creating…' : 'Activate account'}
        </button>
        <p className="m-0 mt-4 text-center text-[11px] leading-relaxed text-zinc-600">
          Credentials are stored (PBKDF2-hashed) in the backend volume.
          Forgot them? Remove the auth file — see README.
        </p>
      </form>
    </div>
  )
}

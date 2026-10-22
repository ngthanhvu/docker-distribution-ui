import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import { Logo } from '../components/icons'

export default function LoginPage({ onDone }: { onDone: (username: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api.auth.login(username, password, remember)
      onDone(res.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
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
        <h1 className="m-0 text-center text-lg font-bold text-white">Sign in to Registry</h1>
        <p className="mt-1.5 mb-6 text-center text-[12px] text-zinc-500">
          Manage your private registry.
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
            autoComplete="username"
            spellCheck={false}
            className="mt-1.5 w-full border border-zinc-800 bg-black px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-zinc-400 placeholder:text-zinc-600"
          />
        </label>
        <label className="mb-6 block">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1.5 w-full border border-zinc-800 bg-black px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-zinc-400 placeholder:text-zinc-600"
          />
        </label>
        <button
          type="button"
          role="checkbox"
          aria-checked={remember}
          onClick={() => setRemember((v) => !v)}
          className="mb-6 flex cursor-pointer select-none items-center gap-2.5"
        >
          <span
            className={`flex h-3.5 w-3.5 items-center justify-center border transition-colors ${
              remember ? 'border-sky-500/60 bg-sky-500/20 text-sky-300' : 'border-zinc-700 bg-zinc-950'
            }`}
          >
            {remember && (
              <span className="text-[10px] font-bold leading-none text-sky-300">✕</span>
            )}
          </span>
          <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">
            Remember me
          </span>
        </button>
        <button
          type="submit"
          className="w-full border border-sky-500/40 bg-sky-500/10 py-2.5 text-[12.5px] font-medium uppercase tracking-widest text-sky-300 transition-colors duration-150 hover:border-sky-400 hover:bg-sky-500/20 hover:text-sky-100 active:bg-sky-500/30 disabled:pointer-events-none disabled:opacity-40 select-none"
          disabled={busy}
        >
          {busy ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

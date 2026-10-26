import { Link } from 'react-router-dom'
import type { ActivityEvent } from '../types'
import { formatDate, shortDigest, timeAgo } from '../format'

const actionLabel: Record<string, string> = {
  push: 'push',
  pull: 'pull',
  delete: 'delete',
  mount: 'mount',
  login: 'login',
}

const glyph: Record<string, string> = {
  push: '+',
  pull: '>',
  delete: 'x',
  mount: '~',
  login: '@',
}

const glyphColor: Record<string, string> = {
  push: 'text-emerald-400',
  pull: 'text-sky-400',
  delete: 'text-red-400',
  mount: 'text-amber-400',
  login: 'text-cyan-400',
}

export default function ActivityFeed({
  events,
  showRepo = true,
}: {
  events: ActivityEvent[]
  showRepo?: boolean
}) {
  if (events.length === 0) {
    return (
      <p className="m-0 text-[12px] text-zinc-600">
        No activity yet — push or pull an image and it will show up here.
      </p>
    )
  }
  return (
    <div className="max-h-135 overflow-y-auto pr-1">
      <ul className="m-0 list-none p-0">
        {events.map((ev) => {
          const isLogin = ev.action === 'login'
          const target = isLogin
            ? `docker login · ${ev.account ?? 'unknown'}`
            : ev.repository + (ev.tag ? `:${ev.tag}` : '')
          return (
            <li key={ev.id} className="border-b border-zinc-900 py-2.5 last:border-b-0">
              <div className="flex items-baseline gap-2">
                <span
                  className={`shrink-0 text-[12px] font-bold ${
                    glyphColor[ev.action] ?? 'text-zinc-200'
                  }`}
                >
                  {glyph[ev.action] ?? '*'}
                </span>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] ${glyphColor[ev.action] ?? 'text-zinc-500'}`}>
                  {actionLabel[ev.action] ?? ev.action}
                </span>
                {showRepo && !isLogin && ev.repository ? (
                  <Link
                    viewTransition
                    to={`/repo/${encodeURIComponent(ev.repository)}`}
                    className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-300 transition-colors hover:text-white"
                  >
                    {target}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-300">
                    {isLogin ? target : ev.tag || shortDigest(ev.digest ?? '')}
                  </span>
                )}
                <span
                  className="shrink-0 text-[11px] text-zinc-600"
                  title={formatDate(ev.timestamp)}
                >
                  {timeAgo(ev.timestamp)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-zinc-600">
                {ev.digest && <span title={ev.digest}>{shortDigest(ev.digest)}</span>}
                {ev.userAgent && <span className="max-w-50 truncate">{ev.userAgent}</span>}
                {ev.addr && <span className="max-w-50 truncate">{ev.addr}</span>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

import { Link } from 'react-router-dom'
import type { ActivityEvent } from '../types'
import { formatDate, shortDigest, timeAgo } from '../format'

const actionLabel: Record<string, string> = {
  push: 'push',
  pull: 'pull',
  delete: 'delete',
  mount: 'mount',
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
      <p className="muted feed-empty">
        No activity yet — push or pull an image and it will show up here.
      </p>
    )
  }
  return (
    <div className="feed">
      {events.map((ev) => {
        const target = ev.repository + (ev.tag ? `:${ev.tag}` : '')
        return (
          <div key={ev.id} className={`feed-item act-${ev.action}`}>
            <span className="feed-dot" />
            <div className="feed-body">
              <div className="feed-line1">
                <span className="feed-action">{actionLabel[ev.action] ?? ev.action}</span>
                {showRepo ? (
                  <Link
                    to={`/repo/${encodeURIComponent(ev.repository)}`}
                    className="feed-target mono"
                  >
                    {target}
                  </Link>
                ) : (
                  <span className="feed-target mono">{ev.tag || shortDigest(ev.digest ?? '')}</span>
                )}
              </div>
              <div className="feed-line2 mono">
                {ev.digest && <span title={ev.digest}>{shortDigest(ev.digest)}</span>}
                {ev.userAgent && <span className="feed-ua">{ev.userAgent}</span>}
                {ev.addr && <span className="feed-ua">{ev.addr}</span>}
              </div>
            </div>
            <span className="feed-time" title={formatDate(ev.timestamp)}>
              {timeAgo(ev.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

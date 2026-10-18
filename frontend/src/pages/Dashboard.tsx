import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, pool, useConfig } from '../api'
import type { ActivityEvent, CatalogEntry, RepoSummary, StorageStats } from '../types'
import { formatSize, timeAgo } from '../format'
import { ChevronRight, RefreshIcon, SearchIcon } from '../components/icons'
import { BoxIcon, ClockIcon, DiskIcon, RecycleIcon, TagIcon } from '../components/icons'
import CodeBlock from '../components/CodeBlock'
import { Badge } from '../components/Badges'
import ActivityFeed from '../components/ActivityFeed'
import StatCard from '../components/StatCard'

export default function Dashboard() {
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null)
  const [details, setDetails] = useState<Record<string, RepoSummary>>({})
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [storage, setStorage] = useState<StorageStats | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const cfg = useConfig()
  const navigate = useNavigate()

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    setDetails({})
    setEntries(null)
    api
      .catalog()
      .then((res) => {
        setEntries(res.repositories)
        setLoading(false)
        void pool(res.repositories.map((e) => e.name), 4, async (name) => {
          const summary = await api.repo(name)
          setDetails((d) => ({ ...d, [name]: summary }))
        })
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
    api
      .activity(30)
      .then((res) => setEvents(res.events))
      .catch(() => setEvents([]))
    api
      .storage()
      .then(setStorage)
      .catch(() => setStorage(null))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.name.toLowerCase().includes(q))
  }, [entries, query])

  const totalTags = useMemo(
    () => (entries ?? []).reduce((acc, e) => acc + e.tagCount, 0),
    [entries],
  )
  const logicalSize = useMemo(
    () => Object.values(details).reduce((acc, r) => acc + r.totalSize, 0),
    [details],
  )
  const maxSize = useMemo(
    () => Math.max(1, ...Object.values(details).map((r) => r.totalSize)),
    [details],
  )

  const go = (name: string) => navigate(`/repo/${encodeURIComponent(name)}`)

  const diskValue = storage?.available ? formatSize(storage.totalBytes) : formatSize(logicalSize)
  const diskSub = storage?.available
    ? storage.blobCount > 0
      ? `${storage.blobCount.toLocaleString()} blobs`
      : 'empty'
    : entries
      ? 'logical'
      : ''

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Repositories</h1>
          <p className="muted">
            {entries ? `${entries.length} repositories · ${totalTags} tags` : 'Loading…'}
          </p>
        </div>
        <button type="button" className="btn" onClick={load} disabled={loading}>
          <RefreshIcon /> Refresh
        </button>
      </div>

      {error && <div className="error-box">Failed to load catalog: {error}</div>}

      <div className="stats">
        <StatCard icon={<BoxIcon />} value={entries ? entries.length : '—'} label="Repositories" />
        <StatCard icon={<TagIcon />} value={entries ? totalTags : '—'} label="Tags" />
        <StatCard
          icon={<DiskIcon />}
          value={diskValue}
          label="Disk usage"
          sub={diskSub}
          title={
            storage?.available
              ? `Real on-disk usage, scanned ${timeAgo(storage.scannedAt)}`
              : 'Sum of image sizes (storage not mounted)'
          }
        />
        <StatCard
          icon={<RecycleIcon />}
          value={storage?.available ? formatSize(storage.reclaimableBytes) : '—'}
          label="Reclaimable"
          sub={
            storage?.available && storage.reclaimableCount > 0
              ? `${storage.reclaimableCount} blobs`
              : undefined
          }
          title="Blobs no longer referenced by any repository — run registry garbage-collect to free them"
        />
      </div>

      {loading && (
        <div className="panel">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      )}

      {entries && entries.length === 0 && (
        <div className="panel empty-state">
          <h2>Your registry is empty</h2>
          <p className="muted">Push your first image to get started:</p>
          <CodeBlock
            lines={[
              '# pull any image and retag it for your registry',
              'docker pull hello-world:latest',
              `docker tag hello-world:latest ${cfg?.registryPublicUrl ?? 'localhost:5000'}/demo`,
              `docker push ${cfg?.registryPublicUrl ?? 'localhost:5000'}/demo`,
            ]}
          />
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="dash-grid">
          <div className="panel table-panel">
            <div className="table-toolbar">
              <div className="search">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Filter repositories…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Tags</th>
                  <th className="col-size">Size</th>
                  <th className="col-push">Last pushed</th>
                  <th className="col-pull">Last pulled</th>
                  <th aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const detail = details[entry.name]
                  const tags = detail?.tags.slice(-3).reverse() ?? []
                  const lastPush = entry.lastPush ?? detail?.lastCreated
                  return (
                    <tr key={entry.name} className="row-link" onClick={() => go(entry.name)}>
                      <td>
                        <Link
                          to={`/repo/${encodeURIComponent(entry.name)}`}
                          className="repo-link mono"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {entry.name}
                        </Link>
                      </td>
                      <td>
                        {detail ? (
                          <span className="badges">
                            {tags.map((t) => (
                              <Badge key={t.name}>{t.name}</Badge>
                            ))}
                            {entry.tagCount > 3 && (
                              <Badge variant="dim">+{entry.tagCount - 3}</Badge>
                            )}
                          </span>
                        ) : entry.tagCount > 0 ? (
                          <span className="badge">{entry.tagCount} tags</span>
                        ) : (
                          <span className="skeleton-inline" />
                        )}
                      </td>
                      <td className="col-size">
                        {detail ? (
                          <div className="sizebar">
                            <span className="mono">{formatSize(detail.totalSize)}</span>
                            <div className="sizebar-track">
                              <div
                                className="sizebar-fill"
                                style={{ width: `${Math.max(2, (detail.totalSize / maxSize) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="skeleton-inline" />
                        )}
                      </td>
                      <td className="col-push">
                        {detail || entry.lastPush ? (
                          lastPush ? (
                            <span title={lastPush}>{timeAgo(lastPush)}</span>
                          ) : (
                            '—'
                          )
                        ) : (
                          <span className="skeleton-inline" />
                        )}
                      </td>
                      <td className="col-pull">
                        {entry.lastPull ? (
                          <span title={entry.lastPull}>{timeAgo(entry.lastPull)}</span>
                        ) : (
                          <span className="muted" title="No pull since activity tracking was enabled">
                            never
                          </span>
                        )}
                      </td>
                      <td className="chevron">
                        <ChevronRight />
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted table-empty">
                      No repositories match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="dash-side">
            <div className="panel feed-panel">
              <h3>
                <ClockIcon /> Recent activity
              </h3>
              <ActivityFeed events={events} />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

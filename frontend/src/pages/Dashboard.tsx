import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, pool, useConfig } from '../api'
import type { ActivityEvent, CatalogEntry, RepoSummary, StorageStats } from '../types'
import { formatSize, registryRef, timeAgo } from '../format'
import CodeBlock from '../components/CodeBlock'
import CopyButton from '../components/CopyButton'
import TermButton from '../components/TermButton'
import { Badge } from '../components/Badges'
import ActivityFeed from '../components/ActivityFeed'
import StatCard from '../components/StatCard'
import { ActivityIcon, BoxIcon, DiskIcon, TagIcon } from '../components/icons'

const th =
  'border-b border-zinc-800 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-600'

function countRecentActivity(events: ActivityEvent[]) {
  const cutoff = Date.now() - 24 * 3600 * 1000
  const recent = events.filter((ev) => new Date(ev.timestamp).getTime() >= cutoff)
  return {
    total: recent.filter((ev) => ev.action === 'push' || ev.action === 'pull').length,
    pushes: recent.filter((ev) => ev.action === 'push').length,
    pulls: recent.filter((ev) => ev.action === 'pull').length,
  }
}

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
  const searchRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return
      }
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
  const maxSize = useMemo(
    () => Math.max(1, ...Object.values(details).map((r) => r.totalSize)),
    [details],
  )
  const activity24 = useMemo(() => countRecentActivity(events), [events])

  const go = (name: string) => navigate(`/repo/${encodeURIComponent(name)}`)

  const publicUrl = registryRef(cfg?.registryPublicUrl ?? 'localhost:5000')

  const diskValue = storage?.available
    ? formatSize(storage.totalBytes)
    : formatSize(
        Object.values(details).reduce((acc, r) => acc + r.totalSize, 0),
      )
  const diskSub = storage?.available
    ? [
        storage.reclaimableBytes > 0
          ? `+ ${formatSize(storage.reclaimableBytes)} reclaimable`
          : null,
        storage.blobCount > 0 ? `${storage.blobCount.toLocaleString()} blobs` : 'empty',
      ]
        .filter(Boolean)
        .join(' · ')
    : entries
      ? 'logical'
      : ''

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-xl font-bold tracking-tight text-white">Repositories</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-zinc-500">
            {entries ? `${entries.length} repositories · ${totalTags} tags` : 'Loading…'}
          </p>
        </div>
        <TermButton onClick={load} disabled={loading}>
          {loading ? 'Syncing' : 'Refresh'}
        </TermButton>
      </div>

      {error && (
        <div className="mb-4 border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12.5px] text-red-400">
          Failed to load catalog: {error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<BoxIcon className="text-sky-400" />}
          value={entries ? entries.length : '—'}
          label="Repositories"
        />
        <StatCard
          icon={<TagIcon className="text-emerald-400" />}
          value={entries ? totalTags : '—'}
          label="Tags"
        />
        <StatCard
          icon={<DiskIcon className="text-purple-400" />}
          value={diskValue}
          label="Storage"
          sub={diskSub || undefined}
          title={
            storage?.available
              ? `Real on-disk usage, scanned ${timeAgo(storage.scannedAt)}`
              : 'Sum of image sizes (storage not mounted)'
          }
        />
        <StatCard
          icon={<ActivityIcon className="text-amber-400" />}
          value={activity24.total}
          label="Activity · 24h"
          sub={`${activity24.pushes} push · ${activity24.pulls} pull`}
        />
      </div>

      {loading && (
        <div className="border border-zinc-800 bg-zinc-950 py-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      )}

      {entries && entries.length === 0 && (
        <div className="border border-zinc-800 bg-zinc-950 p-10 text-center">
          <h2 className="m-0 mb-1.5 text-base font-bold text-white">Your registry is empty</h2>
          <p className="m-0 mb-4 text-[12.5px] text-zinc-500">
            Push your first image to get started:
          </p>
          <div className="mx-auto max-w-lg text-left">
            <CodeBlock
              lines={[
                '# pull any image and retag it for your registry',
                'docker pull hello-world:latest',
                `docker tag hello-world:latest ${publicUrl}/demo`,
                `docker push ${publicUrl}/demo`,
              ]}
            />
          </div>
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 overflow-hidden border border-zinc-800 bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-3">
              <div className="flex w-full max-w-sm items-center gap-2 border border-zinc-800 bg-black px-3 py-1.5 transition-colors focus-within:border-zinc-400">
                <span className="text-[13px] text-zinc-600">&gt;</span>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Filter repositories..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-transparent text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600"
                />
                <kbd className="border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  /
                </kbd>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} text-left`}>Name</th>
                    <th className={`${th} text-left`}>Tags</th>
                    <th className={`${th} hidden text-left md:table-cell`}>Size</th>
                    <th className={`${th} hidden text-left md:table-cell`}>Last pushed</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => {
                    const detail = details[entry.name]
                    const tags = detail?.tags.slice(-3).reverse() ?? []
                    const lastPush = entry.lastPush ?? detail?.lastCreated
                    const pullCmd = `docker pull ${publicUrl}/${entry.name}`
                    return (
                      <tr
                        key={entry.name}
                        className="group cursor-pointer border-b border-zinc-900 transition-colors last:border-b-0 hover:bg-zinc-900"
                        onClick={() => go(entry.name)}
                      >
                        <td className="whitespace-nowrap px-4 py-3 align-middle">
                          <Link
                            to={`/repo/${encodeURIComponent(entry.name)}`}
                            className="text-[13px] font-medium text-zinc-100 transition-colors hover:text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {entry.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {detail ? (
                            tags.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {tags.map((t) => (
                                  <Link
                                    key={t.name}
                                    to={`/repo/${encodeURIComponent(entry.name)}/${encodeURIComponent(t.name)}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="transition-opacity hover:opacity-80"
                                  >
                                    <Badge>{t.name}</Badge>
                                  </Link>
                                ))}
                                {entry.tagCount > tags.length && (
                                  <Badge variant="dim">+{entry.tagCount - tags.length}</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-[12.5px] text-zinc-600">0</span>
                            )
                          ) : (
                            <span className="text-[12.5px] text-zinc-500">{entry.tagCount}</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 align-middle md:table-cell">
                          {detail ? (
                            <div className="flex flex-col gap-1.5 pr-4">
                              <span className="text-[12.5px] text-zinc-300">
                                {formatSize(detail.totalSize)}
                              </span>
                              <div className="h-0.75 w-full max-w-30 bg-zinc-900">
                                <div
                                  className="h-full bg-sky-500"
                                  style={{
                                    width: `${Math.max(2, (detail.totalSize / maxSize) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="skeleton-inline" />
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 align-middle text-[12.5px] text-zinc-500 md:table-cell">
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
                        <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                          <span
                            className="inline-flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <code className="hidden max-w-60 truncate text-[11px] text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 xl:block">
                              {`$ ${pullCmd}`}
                            </code>
                            <CopyButton text={pullCmd} title={`Copy: ${pullCmd}`} />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-[12.5px] text-zinc-600"
                      >
                        No repositories match “{query}”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="grid gap-4 lg:sticky lg:top-16">
            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <ActivityIcon size={13} className="text-amber-400" />
                  Activity
                </span>
                {events.length > 0 && (
                  <span className="font-normal text-zinc-600">{events.length}</span>
                )}
              </h3>
              <ActivityFeed events={events} />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

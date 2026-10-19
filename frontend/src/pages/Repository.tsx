import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, useConfig } from '../api'
import type { ActivityEvent, RepoSummary, TagInfo } from '../types'
import { formatDate, formatSize, shortDigest, timeAgo } from '../format'
import { Badge, KindBadge, TagPlatformCell } from '../components/Badges'
import CodeBlock from '../components/CodeBlock'
import ConfirmDialog from '../components/ConfirmDialog'
import CopyButton from '../components/CopyButton'
import TermButton from '../components/TermButton'
import ActivityFeed from '../components/ActivityFeed'
import StatCard from '../components/StatCard'
import { ActivityIcon, ClockIcon, DiskIcon, PullIcon, TagIcon, TerminalIcon } from '../components/icons'

const th =
  'border-b border-zinc-800 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-600'

function repoPath(name: string): string {
  return encodeURIComponent(name)
}

export default function Repository() {
  const { name } = useParams()
  const repo = name ?? ''
  const cfg = useConfig()

  const [data, setData] = useState<RepoSummary | null>(null)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState<TagInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const load = useCallback(() => {
    setData(null)
    setError('')
    api
      .repo(repo)
      .then(setData)
      .catch((err: Error) => setError(err.message))
    api
      .activity(10, repo)
      .then((res) => setEvents(res.events))
      .catch(() => setEvents([]))
  }, [repo])

  useEffect(() => {
    load()
  }, [load])

  const filtered = (data?.tags ?? []).filter((t) =>
    t.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const publicUrl = cfg?.registryPublicUrl ?? 'localhost:5000'
  const pullLatest = `docker pull ${publicUrl}/${repo}:latest`

  const confirmDelete = async () => {
    if (!toDelete) return
    setBusy(true)
    setDeleteError('')
    try {
      await api.deleteManifest(repo, toDelete.digest)
      setToDelete(null)
      load()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'delete failed')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div>
        <div className="mb-5 border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12.5px] text-red-400">
          Failed to load repository: {error}
        </div>
        <Link
          to="/"
          className="inline-flex items-center px-2 py-1.5 text-[12px] uppercase tracking-[0.08em] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        >
          [ BACK ]
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center px-2 py-1.5 text-[12px] uppercase tracking-[0.08em] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            title="Back to repositories"
          >
            [ BACK ]
          </Link>
          <div className="min-w-0">
            <h1 className="m-0 break-all text-xl font-bold tracking-tight text-white">
              {repo}
            </h1>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-zinc-500">
              {data ? `${data.tagCount} TAGS · ${formatSize(data.totalSize)}` : 'LOADING…'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-w-0 items-center gap-2 border border-zinc-800 bg-black py-1.5 pl-3 pr-1.5">
            <span className="text-[12px] text-zinc-600">$</span>
            <code className="max-w-70 truncate text-[12.5px] text-zinc-100">
              {pullLatest}
            </code>
            <CopyButton text={pullLatest} title="Copy pull command" />
          </span>
          <TermButton onClick={load} disabled={!data}>
            Refresh
          </TermButton>
        </div>
      </div>

      {data && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<TagIcon className="text-emerald-400" />}
            value={data.tagCount}
            label="Tags"
          />
          <StatCard
            icon={<DiskIcon className="text-purple-400" />}
            value={formatSize(data.totalSize)}
            label="Total size"
            sub="unique manifests"
          />
          <StatCard
            icon={<ClockIcon className="text-sky-400" />}
            value={
              data.lastPush
                ? timeAgo(data.lastPush)
                : data.lastCreated
                  ? timeAgo(data.lastCreated)
                  : '—'
            }
            label="Last pushed"
            title={data.lastPush ?? data.lastCreated}
          />
          <StatCard
            icon={<PullIcon className="text-amber-400" />}
            value={data.pullCount ?? 0}
            label="Pulls"
            sub={data.lastPull ? `last ${timeAgo(data.lastPull)}` : 'never'}
            title="Counted since activity tracking was enabled"
          />
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="min-w-0 overflow-hidden border border-zinc-800 bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-3">
            <div className="flex w-full max-w-xs items-center gap-2 border border-zinc-800 bg-black px-3 py-1.5 transition-colors focus-within:border-zinc-400">
              <span className="text-[13px] text-zinc-600">&gt;</span>
              <input
                type="text"
                placeholder="Filter tags..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${th} text-left`}>Tag</th>
                  <th className={`${th} text-left`}>Type</th>
                  <th className={`${th} text-left`}>Platform</th>
                  <th className={`${th} text-left`}>Digest</th>
                  <th className={`${th} text-left`}>Size</th>
                  <th className={`${th} hidden text-left md:table-cell`}>Pushed</th>
                  <th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!data && (
                  <tr>
                    <td colSpan={7} className="px-4 py-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="skeleton-row" />
                      ))}
                    </td>
                  </tr>
                )}
                {data &&
                  filtered.map((tag) => (
                    <tr
                      key={tag.name}
                      className="border-b border-zinc-900 transition-colors last:border-b-0 hover:bg-zinc-900"
                    >
                      <td className="px-4 py-3 align-middle">
                        <Link
                          className="text-[13px] font-medium text-sky-400 transition-colors hover:text-sky-300 hover:underline"
                          to={`/repo/${repoPath(repo)}/${encodeURIComponent(tag.name)}`}
                        >
                          {tag.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <KindBadge kind={tag.kind} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <TagPlatformCell tag={tag} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle">
                        <span className="mr-1 text-[12px] text-zinc-500" title={tag.digest}>
                          {shortDigest(tag.digest)}
                        </span>
                        <CopyButton text={tag.digest} title="Copy digest" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-[12.5px] text-zinc-300">
                        {tag.totalSize >= 0 ? formatSize(tag.totalSize) : '—'}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 align-middle text-[12.5px] text-zinc-500 md:table-cell">
                        {tag.created ? (
                          <span title={formatDate(tag.created)}>{timeAgo(tag.created)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                        <TermButton
                          danger
                          title="Delete manifest"
                          onClick={() => {
                            setDeleteError('')
                            setToDelete(tag)
                          }}
                        >
                          Delete
                        </TermButton>
                      </td>
                    </tr>
                  ))}
                {data && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-[12.5px] text-zinc-600"
                    >
                      {data.tagCount === 0
                        ? 'No tags — all manifests were deleted. Garbage collection will reclaim the storage.'
                        : `No tags match “${query}”.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-16">
          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <TerminalIcon size={13} className="text-sky-400" />
              Push &amp; pull
            </h3>
            <CodeBlock
              lines={[
                '# push an image to this repository',
                `docker tag myapp:1.0 ${publicUrl}/${repo}:1.0`,
                `docker push ${publicUrl}/${repo}:1.0`,
                '',
                '# pull it back',
                `docker pull ${publicUrl}/${repo}:1.0`,
              ]}
            />
          </div>
          {data && data.tags.length > 0 && (
            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                <TagIcon size={13} className="text-emerald-400" />
                Latest tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.tags
                  .slice(-8)
                  .reverse()
                  .map((t) => (
                    <Link
                      key={t.name}
                      to={`/repo/${repoPath(repo)}/${encodeURIComponent(t.name)}`}
                    >
                      <Badge>{t.name}</Badge>
                    </Link>
                  ))}
              </div>
            </div>
          )}
          <div className="border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <ActivityIcon size={13} className="text-amber-400" />
              Activity
            </h3>
            <ActivityFeed events={events} showRepo={false} />
          </div>
        </aside>
      </div>

      {toDelete && (
        <ConfirmDialog
          title={`Delete ${toDelete.name}?`}
          message={`This deletes manifest ${shortDigest(toDelete.digest)} from ${repo}. All tags pointing to the same manifest will disappear. Layer blobs remain on disk until the registry runs garbage collection.`}
          busy={busy}
          onConfirm={confirmDelete}
          onClose={() => {
            if (!busy) {
              setToDelete(null)
              setDeleteError('')
            }
          }}
        />
      )}
      {deleteError && (
        <div className="fixed bottom-6 left-1/2 z-60 max-w-md -translate-x-1/2 border border-red-500/40 bg-black px-4 py-3 text-[12.5px] text-red-400">
          Delete failed: {deleteError}
        </div>
      )}
    </>
  )
}

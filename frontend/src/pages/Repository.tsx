import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, useConfig } from '../api'
import type { ActivityEvent, RepoSummary, TagInfo } from '../types'
import { formatDate, formatSize, shortDigest, timeAgo } from '../format'
import { Badge, KindBadge, TagPlatformCell } from '../components/Badges'
import CodeBlock from '../components/CodeBlock'
import ConfirmDialog from '../components/ConfirmDialog'
import CopyButton from '../components/CopyButton'
import ActivityFeed from '../components/ActivityFeed'
import StatCard from '../components/StatCard'
import {
  BoxIcon,
  ClockIcon,
  DiskIcon,
  PullIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
} from '../components/icons'

function repoPath(name: string): string {
  return name
    .split('/')
    .map(encodeURIComponent)
    .join('/')
}

export default function Repository() {
  const { name } = useParams()
  const repo = decodeURIComponent(name ?? '')
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
      <div className="page-head">
        <div>
          <nav className="breadcrumbs">
            <Link to="/">Repositories</Link> <span>/</span>{' '}
            <span className="mono">{repo}</span>
          </nav>
          <div className="error-box mt">Failed to load repository: {error}</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <nav className="breadcrumbs">
        <Link to="/">Repositories</Link>
        <span>/</span>
        <span className="mono current">{repo}</span>
      </nav>

      <div className="page-head">
        <div>
          <h1 className="mono repo-title">{repo}</h1>
          <p className="muted">
            {data ? `${data.tagCount} tags · ${formatSize(data.totalSize)}` : 'Loading…'}
          </p>
        </div>
        <button type="button" className="btn" onClick={load} disabled={!data}>
          <RefreshIcon /> Refresh
        </button>
      </div>

      {data && (
        <div className="stats">
          <StatCard icon={<BoxIcon />} value={data.tagCount} label="Tags" />
          <StatCard
            icon={<DiskIcon />}
            value={formatSize(data.totalSize)}
            label="Total size"
            sub="unique manifests"
          />
          <StatCard
            icon={<ClockIcon />}
            value={data.lastPush ? timeAgo(data.lastPush) : data.lastCreated ? timeAgo(data.lastCreated) : '—'}
            label="Last pushed"
            title={data.lastPush ?? data.lastCreated}
          />
          <StatCard
            icon={<PullIcon />}
            value={data.pullCount ?? 0}
            label="Pulls"
            sub={data.lastPull ? `last ${timeAgo(data.lastPull)}` : 'never'}
            title="Counted since activity tracking was enabled"
          />
        </div>
      )}

      <div className="grid-2">
        <div className="panel table-panel">
          <div className="table-toolbar">
            <div className="search">
              <SearchIcon />
              <input
                type="text"
                placeholder="Filter tags…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Type</th>
                <th>Platform</th>
                <th>Digest</th>
                <th>Size</th>
                <th>Created</th>
                <th aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {!data && (
                <tr>
                  <td colSpan={7}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="skeleton-row" />
                    ))}
                  </td>
                </tr>
              )}
              {data &&
                filtered.map((tag) => (
                  <tr key={tag.name}>
                    <td>
                      <Link
                        className="tag-link mono"
                        to={`/repo/${repoPath(repo)}/${encodeURIComponent(tag.name)}`}
                      >
                        {tag.name}
                      </Link>
                    </td>
                    <td>
                      <KindBadge kind={tag.kind} />
                    </td>
                    <td>
                      <TagPlatformCell tag={tag} />
                    </td>
                    <td>
                      <span className="mono digest" title={tag.digest}>
                        {shortDigest(tag.digest)}
                      </span>
                      <CopyButton text={tag.digest} title="Copy digest" />
                    </td>
                    <td className="mono">
                      {tag.totalSize >= 0 ? formatSize(tag.totalSize) : '—'}
                    </td>
                    <td>
                      {tag.created ? (
                        <span title={formatDate(tag.created)}>{timeAgo(tag.created)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-icon danger"
                        title="Delete manifest"
                        onClick={() => {
                          setDeleteError('')
                          setToDelete(tag)
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              {data && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted table-empty">
                    {data.tagCount === 0
                      ? 'No tags — all manifests were deleted. Garbage collection will reclaim the storage.'
                      : `No tags match “${query}”.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="side">
          <div className="panel">
            <h3>Push &amp; pull</h3>
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
            <div className="panel">
              <h3>Latest tags</h3>
              <div className="badges wrap">
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
          <div className="panel">
            <h3>
              <ClockIcon /> Activity
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
        <div className="modal-error error-box">Delete failed: {deleteError}</div>
      )}
    </>
  )
}

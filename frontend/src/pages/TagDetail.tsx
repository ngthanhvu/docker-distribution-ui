import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, useConfig } from '../api'
import type { ManifestInfo } from '../types'
import { formatDate, formatSize, shortDigest, timeAgo } from '../format'
import { KindBadge, PlatformBadges } from '../components/Badges'
import CodeBlock from '../components/CodeBlock'
import ConfigPanel from '../components/ConfigPanel'
import ConfirmDialog from '../components/ConfirmDialog'
import CopyButton from '../components/CopyButton'
import JsonView from '../components/JsonView'
import Layers from '../components/Layers'
import StatCard from '../components/StatCard'
import {
  ChevronRight,
  ClockIcon,
  CpuIcon,
  DiskIcon,
  LayersIcon,
  RefreshIcon,
  TrashIcon,
} from '../components/icons'

function repoPath(name: string): string {
  return name
    .split('/')
    .map(encodeURIComponent)
    .join('/')
}

export default function TagDetail() {
  const { name, ref } = useParams()
  const repo = decodeURIComponent(name ?? '')
  const reference = decodeURIComponent(ref ?? '')
  const navigate = useNavigate()
  const cfg = useConfig()

  const [info, setInfo] = useState<ManifestInfo | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setInfo(null)
    setError('')
    api
      .manifest(repo, reference)
      .then(setInfo)
      .catch((err: Error) => setError(err.message))
  }, [repo, reference])

  const doDelete = async () => {
    if (!info) return
    setBusy(true)
    try {
      await api.deleteManifest(repo, info.digest)
      navigate(`/repo/${repoPath(repo)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'delete failed')
      setBusy(false)
    }
  }

  if (error) {
    return (
      <>
        <nav className="breadcrumbs">
          <Link to="/">Repositories</Link>
          <span>/</span>
          <Link to={`/repo/${repoPath(repo)}`} className="mono">
            {repo}
          </Link>
          <span>/</span>
          <span className="mono current">{reference}</span>
        </nav>
        <div className="error-box mt">Failed to load manifest: {error}</div>
      </>
    )
  }

  const publicUrl = cfg?.registryPublicUrl ?? 'localhost:5000'
  const single = info && info.kind !== 'index' ? info.platforms[0] : undefined
  const refLabel = reference.startsWith('sha256:') ? shortDigest(reference) : reference

  return (
    <>
      <nav className="breadcrumbs">
        <Link to="/">Repositories</Link>
        <span>/</span>
        <Link to={`/repo/${repoPath(repo)}`} className="mono">
          {repo}
        </Link>
        <span>/</span>
        <span className="mono current">{refLabel}</span>
      </nav>

      <div className="page-head">
        <div>
          <h1 className="mono repo-title">
            {repo}<span className="tag-sep">:</span>
            <span className="accent">{refLabel}</span>
          </h1>
          <p className="muted">
            {info ? `${info.mediaType}` : 'Loading…'}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setInfo(null)
              api.manifest(repo, reference).then(setInfo).catch((e: Error) => setError(e.message))
            }}
            disabled={!info}
          >
            <RefreshIcon /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirming(true)}
            disabled={!info}
          >
            <TrashIcon /> Delete
          </button>
        </div>
      </div>

      {!info && (
        <div className="panel">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      )}

      {info && (
        <>
          <div className="stats">
            <StatCard
              icon={<CpuIcon />}
              value={<KindBadge kind={info.kind} />}
              label="Type"
            />
            <StatCard
              icon={<DiskIcon />}
              value={formatSize(info.totalSize)}
              label="Total size"
              sub={info.kind === 'index' ? 'all platforms' : undefined}
            />
            <StatCard
              icon={<ClockIcon />}
              value={timeAgo(info.created)}
              label="Created"
              title={info.created ? formatDate(info.created) : undefined}
            />
            <StatCard
              icon={info.kind === 'index' ? <CpuIcon /> : <LayersIcon />}
              value={info.platforms.length}
              label={info.kind === 'index' ? 'Platforms' : 'Layers'}
              sub={
                info.kind !== 'index' && single?.layers
                  ? `${single.layers.filter((l) => !l.empty).length} data`
                  : undefined
              }
            />
          </div>

          <div className="panel">
            <div className="digest-line">
              <span className="kv-key">Digest</span>
              <code className="mono digest-full">{info.digest}</code>
              <CopyButton text={info.digest} title="Copy digest" />
            </div>
          </div>

          {info.kind === 'index' ? (
            <div className="panel table-panel">
              <h3>Platforms</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Digest</th>
                    <th>Size</th>
                    <th>Created</th>
                    <th aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {info.platforms.map((p) => (
                    <tr key={p.digest} className="row-link">
                      <td>
                        <Link
                          to={`/repo/${repoPath(repo)}/${encodeURIComponent(p.digest)}`}
                          className="badges"
                        >
                          <PlatformBadges p={p} />
                          <ChevronRight />
                        </Link>
                      </td>
                      <td>
                        <span className="mono digest" title={p.digest}>
                          {shortDigest(p.digest)}
                        </span>
                        <CopyButton text={p.digest} title="Copy digest" />
                      </td>
                      <td className="mono">{formatSize(p.totalSize)}</td>
                      <td>
                        {p.created ? (
                          <span title={formatDate(p.created)}>{timeAgo(p.created)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="chevron">
                        <Link
                          to={`/repo/${repoPath(repo)}/${encodeURIComponent(p.digest)}`}
                          aria-label="open platform manifest"
                        >
                          <ChevronRight />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : single ? (
            <>
              <div className="grid-2">
                <div className="panel">
                  <h3>Layers &amp; history</h3>
                  <Layers layers={single.layers ?? []} />
                </div>
                <div className="side">
                  {single.config && (
                    <div className="panel">
                      <h3>Image configuration</h3>
                      <ConfigPanel config={single.config} />
                    </div>
                  )}
                  <div className="panel">
                    <h3>Pull</h3>
                    <CodeBlock
                      lines={[`docker pull ${publicUrl}/${repo}:${reference.startsWith('sha256:') ? `<tag>` : reference}`]}
                    />
                  </div>
                </div>
              </div>
              <details className="panel raw-manifest">
                <summary>Raw manifest JSON</summary>
                <JsonView data={info.raw} />
              </details>
            </>
          ) : (
            <div className="panel">
              <p className="muted">No platform details available.</p>
            </div>
          )}
        </>
      )}

      {confirming && info && (
        <ConfirmDialog
          title={`Delete ${refLabel}?`}
          message={`This deletes manifest ${shortDigest(info.digest)} from ${repo}. All tags pointing to it will disappear. Layer blobs remain on disk until the registry runs garbage collection.`}
          busy={busy}
          busyLabel="Deleting…"
          onConfirm={doDelete}
          onClose={() => !busy && setConfirming(false)}
        />
      )}
    </>
  )
}

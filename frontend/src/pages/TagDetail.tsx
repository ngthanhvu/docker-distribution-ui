import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, useConfig } from '../api'
import type { ManifestInfo } from '../types'
import { formatDate, formatSize, registryRef, shortDigest, timeAgo } from '../format'
import { KindBadge, PlatformBadges } from '../components/Badges'
import ConfigPanel from '../components/ConfigPanel'
import ConfirmDialog from '../components/ConfirmDialog'
import CopyButton from '../components/CopyButton'
import JsonView from '../components/JsonView'
import Layers from '../components/Layers'
import StatCard from '../components/StatCard'
import TermButton from '../components/TermButton'
import { ClockIcon, CpuIcon, DiskIcon, LayersIcon } from '../components/icons'

type Tab = 'layers' | 'config' | 'raw'

const th =
  'border-b border-zinc-800 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-600'

function repoPath(name: string): string {
  return encodeURIComponent(name)
}

export default function TagDetail() {
  const { name, ref } = useParams()
  const repo = name ?? ''
  const reference = ref ?? ''
  const navigate = useNavigate()
  const cfg = useConfig()

  const [info, setInfo] = useState<ManifestInfo | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('layers')

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
      navigate(`/repo/${repoPath(repo)}`, { viewTransition: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'delete failed')
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div>
        <div className="mb-5 border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12.5px] text-red-400">
          Failed to load manifest: {error}
        </div>
        <Link
          to={`/repo/${repoPath(repo)}`}
          viewTransition
          className="inline-flex select-none items-center justify-center gap-1 border border-zinc-700/80 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium leading-normal uppercase tracking-[0.08em] text-zinc-300 transition-colors duration-150 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 active:bg-zinc-700"
        >
          ← Back
        </Link>
      </div>
    )
  }

  const publicUrl = registryRef(cfg?.registryPublicUrl ?? 'localhost:5000')
  const single = info && info.kind !== 'index' ? info.platforms[0] : undefined
  const refLabel = reference.startsWith('sha256:') ? shortDigest(reference) : reference
  const pullCmd = `docker pull ${publicUrl}/${repo}:${
    reference.startsWith('sha256:') ? '<tag>' : reference
  }`

  const tabs: Array<{ id: Tab; label: string; disabled?: boolean }> = [
    { id: 'layers', label: info?.kind === 'index' ? 'Platforms' : 'Layers' },
    { id: 'config', label: 'Config', disabled: !single?.config },
    { id: 'raw', label: 'Raw manifest', disabled: !info },
  ]

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={`/repo/${repoPath(repo)}`}
            viewTransition
            className="inline-flex shrink-0 select-none items-center justify-center gap-1 border border-zinc-700/80 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium leading-normal uppercase tracking-[0.08em] text-zinc-300 transition-colors duration-150 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 active:bg-zinc-700"
            title="Back to repository"
          >
            ← Back
          </Link>
          <div className="min-w-0">
            <h1 className="m-0 break-all text-xl font-bold tracking-tight text-white">
              {repo}
              <span className="text-zinc-600">:</span>
              <span className="text-zinc-100">{refLabel}</span>
            </h1>
            <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.08em] text-zinc-500">
              {info ? info.mediaType : 'LOADING…'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-w-0 items-center gap-2 border border-zinc-800 bg-black py-1.5 pl-3 pr-1.5">
            <span className="text-[12px] text-zinc-600">$</span>
            <code className="max-w-xs sm:max-w-md lg:max-w-lg truncate text-[12.5px] text-zinc-100">
              {pullCmd}
            </code>
            <CopyButton text={pullCmd} title="Copy pull command" />
          </span>
          <TermButton
            onClick={() => {
              setInfo(null)
              api.manifest(repo, reference).then(setInfo).catch((e: Error) => setError(e.message))
            }}
            disabled={!info}
          >
            Refresh
          </TermButton>
          <TermButton danger onClick={() => setConfirming(true)} disabled={!info}>
            Delete
          </TermButton>
        </div>
      </div>

      {!info && (
        <div className="border border-zinc-800 bg-zinc-950 py-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      )}

      {info && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<CpuIcon className="text-purple-400" />}
              value={<KindBadge kind={info.kind} />}
              label="Type"
            />
            <StatCard
              icon={<DiskIcon className="text-emerald-400" />}
              value={formatSize(info.totalSize)}
              label="Total size"
              sub={info.kind === 'index' ? 'all platforms' : undefined}
            />
            <StatCard
              icon={<ClockIcon className="text-sky-400" />}
              value={timeAgo(info.created)}
              label="Created"
              title={info.created ? formatDate(info.created) : undefined}
            />
            <StatCard
              icon={
                info.kind === 'index' ? (
                  <CpuIcon className="text-amber-400" />
                ) : (
                  <LayersIcon className="text-amber-400" />
                )
              }
              value={info.platforms.length}
              label={info.kind === 'index' ? 'Platforms' : 'Layers'}
              sub={
                info.kind !== 'index' && single?.layers
                  ? `${single.layers.filter((l) => !l.empty).length} data`
                  : undefined
              }
            />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2 border border-zinc-800 bg-zinc-950 px-4 py-3">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-zinc-500">
              DIGEST
            </span>
            <code className="min-w-0 break-all border border-zinc-800 bg-black px-2 py-1 text-[12.5px] text-zinc-300">
              {info.digest}
            </code>
            <CopyButton text={info.digest} title="Copy digest" />
          </div>

          <div className="overflow-hidden border border-zinc-800 bg-zinc-950">
            <div className="flex border-b border-zinc-800">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={t.disabled}
                  onClick={() => setTab(t.id)}
                  className={`border-b-2 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                    tab === t.id
                      ? 'border-sky-400 bg-sky-500/10 text-sky-300'
                      : 'border-transparent text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto p-4">
              {tab === 'layers' &&
                (info.kind === 'index' ? (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${th} text-left`}>Platform</th>
                        <th className={`${th} text-left`}>Digest</th>
                        <th className={`${th} text-left`}>Size</th>
                        <th className={`${th} text-left`}>Created</th>
                        <th className={`${th} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {info.platforms.map((p) => (
                        <tr
                          key={p.digest}
                          className="border-b border-zinc-900 transition-colors last:border-b-0 hover:bg-zinc-900"
                        >
                          <td className="px-4 py-3 align-middle">
                            <Link
                              viewTransition
                              to={`/repo/${repoPath(repo)}/${encodeURIComponent(p.digest)}`}
                              className="inline-flex flex-wrap items-center gap-1.5"
                            >
                              <PlatformBadges p={p} />
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-middle">
                            <span className="mr-1 text-[12px] text-zinc-500" title={p.digest}>
                              {shortDigest(p.digest)}
                            </span>
                            <CopyButton text={p.digest} title="Copy digest" />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-middle text-[12.5px] text-zinc-300">
                            {formatSize(p.totalSize)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-middle text-[12.5px] text-zinc-500">
                            {p.created ? (
                              <span title={formatDate(p.created)}>{timeAgo(p.created)}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                            <Link
                              viewTransition
                              to={`/repo/${repoPath(repo)}/${encodeURIComponent(p.digest)}`}
                              aria-label="open platform manifest"
                              className="inline-flex items-center px-2 py-1.5 text-[12px] uppercase tracking-[0.08em] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                            >
                              [ OPEN ]
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : single ? (
                  <Layers layers={single.layers ?? []} />
                ) : (
                  <p className="m-0 text-[12.5px] text-zinc-600">
                    No platform details available.
                  </p>
                ))}
              {tab === 'config' &&
                (single?.config ? (
                  <ConfigPanel config={single.config} />
                ) : (
                  <p className="m-0 text-[12.5px] text-zinc-600">
                    No image configuration available.
                  </p>
                ))}
              {tab === 'raw' && <JsonView data={info.raw} />}
            </div>
          </div>
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
